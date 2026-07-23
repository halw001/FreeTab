import type { Space } from '../types';
import { hasHostPermission } from './permissions';
import { sanitizeRemoteData } from './validate';
import { webdavExists, webdavMkcol, webdavGet, webdavPut, basicAuth } from './webdavClient';

const REMOTE_DIR = '/freetab';
const REMOTE_FILE = '/freetab/backup.json';
const STORAGE_KEY = 'freetab-store-v2';

interface StoreState {
  spaces: Space[];
  lastModified: number;
  syncSettings: {
    webdav: {
      enabled: boolean;
      url: string;
      username: string;
      password: string;
      autoSync: boolean;
      lastSyncTime?: number;
    };
  };
}

interface RemoteBackup {
  spaces: Space[];
  lastModified: number;
}

async function loadStateFromStorage(): Promise<StoreState | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const state = result[STORAGE_KEY];
    if (!state) return null;
    return state as StoreState;
  } catch (e: any) {
    console.error('读取 chrome.storage.local 失败:', e?.message || e);
    return null;
  }
}

async function saveStateToStorage(state: StoreState): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch (e: any) {
    console.error('写入 chrome.storage.local 失败:', e?.message || e);
  }
}

async function downloadRemoteState(
  url: string,
  username: string,
  password: string,
): Promise<RemoteBackup | null> {
  const auth = basicAuth(username, password);
  const exists = await webdavExists(url, REMOTE_FILE, auth);
  if (!exists) return null;

  const content = await webdavGet(url, REMOTE_FILE, auth);
  const parsed = JSON.parse(content);

  // 数据校验：过滤掉结构损坏的条目
  const result = sanitizeRemoteData(parsed);
  if (result.dropped > 0) {
    console.warn(`WebDAV 备份数据校验：丢弃了 ${result.dropped} 个无效条目`);
  }

  const spaces = result.spaces;
  let lastModified: number | undefined;

  // 兼容带 lastModified 的新格式
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    lastModified = parsed.lastModified;
  }

  if (lastModified === undefined) {
    // 旧格式没有 lastModified，用当前时间作为 fallback，避免误判远端比本地旧
    lastModified = Date.now();
  }

  return { spaces, lastModified };
}

async function uploadRemoteState(
  url: string,
  username: string,
  password: string,
  spaces: Space[],
  lastModified: number,
): Promise<void> {
  const auth = basicAuth(username, password);
  const dirExists = await webdavExists(url, REMOTE_DIR, auth);
  if (!dirExists) {
    await webdavMkcol(url, REMOTE_DIR, auth);
  }

  const payload: RemoteBackup = { spaces, lastModified };
  const jsonData = JSON.stringify(payload, null, 2);

  await webdavPut(url, REMOTE_FILE, jsonData, auth);
}

function isLocalEmpty(spaces: Space[]): boolean {
  if (!spaces || spaces.length === 0) return true;
  if (spaces.length > 1) return false;
  return spaces[0].groups.length === 0;
}

// BUG 1: 并发锁，防止多个同步任务同时执行
let webdavSyncInProgress = false;

export async function performWebDAVAutoSync(): Promise<void> {
  if (webdavSyncInProgress) {
    console.log('WebDAV 同步正在进行中，跳过本次触发');
    return;
  }
  webdavSyncInProgress = true;
  try {
    await doWebdavSync();
  } catch (error: any) {
    console.error('WebDAV 自动同步失败:', error?.message || error);
  } finally {
    webdavSyncInProgress = false;
  }
}

/**
 * BUG 2/3: 写回前重新读取最新 state，避免覆盖 UI 在同步期间的修改；
 * 构造新对象，不直接修改快照。
 */
async function saveWithLatest(
  updater: (latest: StoreState) => Partial<StoreState>,
): Promise<void> {
  const latest = await loadStateFromStorage();
  if (!latest) return;
  const newState = { ...latest, ...updater(latest) } as StoreState;
  await saveStateToStorage(newState);
}

async function doWebdavSync(): Promise<void> {
  const state = await loadStateFromStorage();
  if (!state) return;

  const { webdav } = state.syncSettings;
  if (!webdav.enabled) return;
  if (!webdav.autoSync) return;
  if (!webdav.url || !webdav.username || !webdav.password) return;

  const permitted = await hasHostPermission(webdav.url);
  if (!permitted) return;

  const localEmpty = isLocalEmpty(state.spaces);
  const localLastModified = state.lastModified;
  const now = Date.now();

  const remote = await downloadRemoteState(
    webdav.url,
    webdav.username,
    webdav.password,
  );

  if (!remote) {
    if (localEmpty) return;
    // 远端为空，上传本地
    // BUG 2: 上传时用最新的本地数据，而非同步开始时读取的快照
    const latest = await loadStateFromStorage();
    if (!latest) return;
    await uploadRemoteState(
      webdav.url,
      webdav.username,
      webdav.password,
      latest.spaces,
      latest.lastModified,
    );
    await saveWithLatest((latest) => ({
      syncSettings: {
        ...latest.syncSettings,
        webdav: { ...latest.syncSettings.webdav, lastSyncTime: now },
      },
    }));
    return;
  }

  const remoteLastModified = remote.lastModified;

  if (localEmpty) {
    if (isLocalEmpty(remote.spaces)) return;
    // 本地为空，用远端覆盖
    await saveWithLatest((latest) => ({
      spaces: remote.spaces,
      lastModified: remoteLastModified,
      syncSettings: {
        ...latest.syncSettings,
        webdav: { ...latest.syncSettings.webdav, lastSyncTime: now },
      },
    }));
    return;
  }

  if (remoteLastModified > localLastModified) {
    // 远端更新，拉取
    await saveWithLatest((latest) => ({
      spaces: remote.spaces,
      lastModified: remoteLastModified,
      syncSettings: {
        ...latest.syncSettings,
        webdav: { ...latest.syncSettings.webdav, lastSyncTime: now },
      },
    }));
    return;
  }

  if (localLastModified > remoteLastModified) {
    // 本地更新，推送
    // BUG 2: 上传时用最新的本地数据
    const latest = await loadStateFromStorage();
    if (!latest) return;
    await uploadRemoteState(
      webdav.url,
      webdav.username,
      webdav.password,
      latest.spaces,
      latest.lastModified,
    );
    await saveWithLatest((latest) => ({
      syncSettings: {
        ...latest.syncSettings,
        webdav: { ...latest.syncSettings.webdav, lastSyncTime: now },
      },
    }));
    return;
  }
}
