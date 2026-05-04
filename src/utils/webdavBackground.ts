import { createClient } from 'webdav';
import type { Space } from '../types';

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
  const client = createClient(url, { username, password });
  const exists = await client.exists(REMOTE_FILE);
  if (!exists) return null;

  const content = await client.getFileContents(REMOTE_FILE, {
    format: 'text',
  });
  if (typeof content !== 'string') {
    throw new Error('远程文件内容格式不正确');
  }

  const data = JSON.parse(content);

  let spaces: Space[];
  let lastModified: number | undefined;

  if (Array.isArray(data)) {
    spaces = data as Space[];
    lastModified = undefined;
  } else if (data && typeof data === 'object') {
    spaces = data.spaces ?? [];
    lastModified = data.lastModified;
  } else {
    throw new Error('远程备份文件格式错误：既不是数组也不是对象');
  }

  if (!Array.isArray(spaces)) {
    throw new Error('远程备份中 spaces 字段不是数组');
  }

  if (lastModified === undefined) {
    lastModified = spaces.reduce(
      (max: number, s: Space) =>
        Math.max(
          max,
          s.groups.reduce(
            (gMax: number, g) =>
              Math.max(
                gMax,
                g.tabs.reduce((tMax: number, t) => Math.max(tMax, t.createdAt ?? 0), 0),
              ),
            0,
          ),
        ),
      0,
    );
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
  const client = createClient(url, { username, password });
  const dirExists = await client.exists(REMOTE_DIR);
  if (!dirExists) {
    await client.createDirectory(REMOTE_DIR);
  }

  const payload: RemoteBackup = { spaces, lastModified };
  const jsonData = JSON.stringify(payload, null, 2);

  await client.putFileContents(REMOTE_FILE, jsonData, { overwrite: true });
}

function isLocalEmpty(spaces: Space[]): boolean {
  if (!spaces || spaces.length === 0) return true;
  const totalTabs = spaces.reduce(
    (sum, s) =>
      sum +
      s.groups.reduce((gSum, g) => gSum + g.tabs.length, 0),
    0,
  );
  return totalTabs === 0;
}

export async function performWebDAVAutoSync(): Promise<void> {
  const state = await loadStateFromStorage();
  if (!state) return;

  const { webdav } = state.syncSettings;
  if (!webdav.enabled) return;
  if (!webdav.autoSync) return;
  if (!webdav.url || !webdav.username || !webdav.password) return;

  const localEmpty = isLocalEmpty(state.spaces);
  const localLastModified = state.lastModified;

  try {
    const remote = await downloadRemoteState(
      webdav.url,
      webdav.username,
      webdav.password,
    );

    const now = Date.now();

    if (!remote) {
      if (localEmpty) return;
      await uploadRemoteState(
        webdav.url,
        webdav.username,
        webdav.password,
        state.spaces,
        localLastModified,
      );
      webdav.lastSyncTime = now;
      await saveStateToStorage(state);
      return;
    }

    const remoteLastModified = remote.lastModified;

    if (localEmpty) {
      state.spaces = remote.spaces;
      state.lastModified = remoteLastModified;
      webdav.lastSyncTime = now;
      await saveStateToStorage(state);
      return;
    }

    if (remoteLastModified > localLastModified) {
      state.spaces = remote.spaces;
      state.lastModified = remoteLastModified;
      webdav.lastSyncTime = now;
      await saveStateToStorage(state);
      return;
    }

    if (localLastModified > remoteLastModified) {
      await uploadRemoteState(
        webdav.url,
        webdav.username,
        webdav.password,
        state.spaces,
        localLastModified,
      );
      webdav.lastSyncTime = now;
      await saveStateToStorage(state);
      return;
    }
  } catch (error: any) {
    console.error('WebDAV 自动同步失败:', error?.message || error);
  }
}
