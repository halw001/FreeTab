import type { Space } from '../types';
import { sanitizeRemoteData } from './validate';

const GIST_API = 'https://api.github.com/gists';
const FILE_NAME = 'freetab_backup.json';
const STORAGE_KEY = 'freetab-store-v2';

interface StoreState {
  spaces: Space[];
  lastModified: number;
  syncSettings: {
    github: {
      enabled: boolean;
      token: string;
      autoSync: boolean;
      gistId?: string;
      lastSyncTime?: number;
    };
  };
}

interface RemoteBackup {
  spaces: Space[];
  lastModified: number;
}

function gistHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
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
  token: string,
  gistId: string,
): Promise<RemoteBackup | null> {
  const res = await fetch(`${GIST_API}/${gistId}`, {
    method: 'GET',
    headers: gistHeaders(token),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`获取 Gist 失败 (${res.status}): ${body}`);
  }

  const data = await res.json();
  const file = data.files?.[FILE_NAME];
  if (!file || !file.content) {
    return null;
  }

  const parsed = JSON.parse(file.content);

  // 数据校验：过滤掉结构损坏的条目
  const result = sanitizeRemoteData(parsed);
  if (result.dropped > 0) {
    console.warn(`Gist 备份数据校验：丢弃了 ${result.dropped} 个无效条目`);
  }

  let spaces = result.spaces;
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

/**
 * 分页查找已存在的 FreeTab Gist，避免因 Gist 数量超过 100 而漏查。
 */
async function findExistingGist(token: string): Promise<string | null> {
  let page = 1;
  const MAX_PAGES = 10; // 最多查 1000 条

  while (page <= MAX_PAGES) {
    const res = await fetch(`${GIST_API}?per_page=100&page=${page}`, {
      method: 'GET',
      headers: gistHeaders(token),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`获取 Gist 列表失败 (${res.status}): ${body}`);
    }

    const gists: Array<{ id: string; files: Record<string, unknown> }> =
      await res.json();
    if (gists.length === 0) return null;

    for (const gist of gists) {
      if (gist.files && FILE_NAME in gist.files) {
        return gist.id;
      }
    }

    // 不足 100 条说明已是最后一页
    if (gists.length < 100) return null;
    page++;
  }

  return null;
}

async function createGist(
  token: string,
  spaces: Space[],
  lastModified: number,
): Promise<string> {
  const payload: RemoteBackup = { spaces, lastModified };
  const jsonData = JSON.stringify(payload, null, 2);

  const res = await fetch(GIST_API, {
    method: 'POST',
    headers: gistHeaders(token),
    body: JSON.stringify({
      description: 'FreeTab Backup',
      public: false,
      files: {
        [FILE_NAME]: { content: jsonData },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`创建 Gist 失败 (${res.status}): ${body}`);
  }

  const data = await res.json();
  const newGistId: string = data.id;
  if (!newGistId) {
    throw new Error('创建 Gist 成功但未返回 ID');
  }

  return newGistId;
}

async function uploadRemoteState(
  token: string,
  gistId: string,
  spaces: Space[],
  lastModified: number,
): Promise<void> {
  const payload: RemoteBackup = { spaces, lastModified };
  const jsonData = JSON.stringify(payload, null, 2);

  const res = await fetch(`${GIST_API}/${gistId}`, {
    method: 'PATCH',
    headers: gistHeaders(token),
    body: JSON.stringify({
      files: {
        [FILE_NAME]: { content: jsonData },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`更新 Gist 失败 (${res.status}): ${body}`);
  }
}

function isLocalEmpty(spaces: Space[]): boolean {
  if (!spaces || spaces.length === 0) return true;
  if (spaces.length > 1) return false;
  return spaces[0].groups.length === 0;
}

// BUG 1: 并发锁，防止多个同步任务同时执行
let gistSyncInProgress = false;

export async function performGistAutoSync(): Promise<void> {
  if (gistSyncInProgress) {
    console.log('Gist 同步正在进行中，跳过本次触发');
    return;
  }
  gistSyncInProgress = true;
  try {
    await doGistSync();
  } catch (error: any) {
    console.error('Gist 自动同步失败:', error?.message || error);
  } finally {
    gistSyncInProgress = false;
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

async function doGistSync(): Promise<void> {
  const state = await loadStateFromStorage();
  if (!state) return;

  const { github } = state.syncSettings;
  if (!github.enabled) return;
  if (!github.autoSync) return;
  if (!github.token) return;

  const localEmpty = isLocalEmpty(state.spaces);
  const localLastModified = state.lastModified;
  const now = Date.now();

  // 没有 gistId：首次使用
  if (!github.gistId) {
    if (localEmpty) {
      // 本地为空，尝试从远端拉取已有备份
      const foundId = await findExistingGist(github.token);
      if (!foundId) return;
      const remote = await downloadRemoteState(github.token, foundId);
      if (!remote) return;
      // BUG 2: 写回前重新读取，避免覆盖同步期间的本地修改
      await saveWithLatest((latest) => ({
        spaces: remote.spaces,
        lastModified: remote.lastModified,
        syncSettings: {
          ...latest.syncSettings,
          github: { ...latest.syncSettings.github, gistId: foundId, lastSyncTime: now },
        },
      }));
      return;
    }

    // 本地非空，创建新 gist 上传
    const newGistId = await createGist(github.token, state.spaces, localLastModified);
    await saveWithLatest((latest) => ({
      syncSettings: {
        ...latest.syncSettings,
        github: { ...latest.syncSettings.github, gistId: newGistId, lastSyncTime: now },
      },
    }));
    return;
  }

  // 有 gistId，下载远端进行对比
  const remote = await downloadRemoteState(github.token, github.gistId);

  if (!remote) {
    if (localEmpty) return;
    // 远端为空，上传本地
    // BUG 2: 上传时用最新的本地数据，而非同步开始时读取的快照
    const latest = await loadStateFromStorage();
    if (!latest) return;
    await uploadRemoteState(github.token, github.gistId, latest.spaces, latest.lastModified);
    await saveWithLatest((latest) => ({
      syncSettings: {
        ...latest.syncSettings,
        github: { ...latest.syncSettings.github, lastSyncTime: now },
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
        github: { ...latest.syncSettings.github, lastSyncTime: now },
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
        github: { ...latest.syncSettings.github, lastSyncTime: now },
      },
    }));
    return;
  }

  if (localLastModified > remoteLastModified) {
    // 本地更新，推送
    // BUG 2: 上传时用最新的本地数据
    const latest = await loadStateFromStorage();
    if (!latest) return;
    await uploadRemoteState(github.token, github.gistId, latest.spaces, latest.lastModified);
    await saveWithLatest((latest) => ({
      syncSettings: {
        ...latest.syncSettings,
        github: { ...latest.syncSettings.github, lastSyncTime: now },
      },
    }));
    return;
  }
}
