import type { Space } from '../types';

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
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
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

  let spaces: Space[];
  let lastModified: number | undefined;

  if (Array.isArray(parsed)) {
    spaces = parsed as Space[];
    lastModified = undefined;
  } else if (parsed && typeof parsed === 'object') {
    spaces = parsed.spaces ?? [];
    lastModified = parsed.lastModified;
  } else {
    throw new Error('Gist 备份文件格式错误');
  }

  if (!Array.isArray(spaces)) {
    throw new Error('Gist 备份中 spaces 字段不是数组');
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

async function findExistingGist(token: string): Promise<string | null> {
  const res = await fetch(`${GIST_API}?per_page=100`, {
    method: 'GET',
    headers: gistHeaders(token),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`获取 Gist 列表失败 (${res.status}): ${body}`);
  }

  const gists: Array<{ id: string; files: Record<string, unknown> }> = await res.json();
  for (const gist of gists) {
    if (gist.files && FILE_NAME in gist.files) {
      return gist.id;
    }
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
  // Only true for the fresh-install default state: exactly 1 space with 0 groups
  if (spaces.length > 1) return false;
  return spaces[0].groups.length === 0;
}

export async function performGistAutoSync(): Promise<void> {
  const state = await loadStateFromStorage();
  if (!state) return;

  const { github } = state.syncSettings;
  if (!github.enabled) return;
  if (!github.autoSync) return;
  if (!github.token) return;

  const localEmpty = isLocalEmpty(state.spaces);
  const localLastModified = state.lastModified;

  try {
    const now = Date.now();

    if (!github.gistId) {
      if (localEmpty) {
        const foundId = await findExistingGist(github.token);
        if (!foundId) return;
        github.gistId = foundId;
        const remote = await downloadRemoteState(github.token, foundId);
        if (!remote) return;
        state.spaces = remote.spaces;
        state.lastModified = remote.lastModified;
        github.lastSyncTime = now;
        await saveStateToStorage(state);
        return;
      }
      const newGistId = await createGist(github.token, state.spaces, localLastModified);
      github.gistId = newGistId;
      github.lastSyncTime = now;
      await saveStateToStorage(state);
      return;
    }

    const remote = await downloadRemoteState(github.token, github.gistId);

    if (!remote) {
      if (localEmpty) return;
      await uploadRemoteState(
        github.token,
        github.gistId,
        state.spaces,
        localLastModified,
      );
      github.lastSyncTime = now;
      await saveStateToStorage(state);
      return;
    }

    const remoteLastModified = remote.lastModified;

    if (localEmpty) {
      if (isLocalEmpty(remote.spaces)) return; // both sides are empty, nothing to sync
      state.spaces = remote.spaces;
      state.lastModified = remoteLastModified;
      github.lastSyncTime = now;
      await saveStateToStorage(state);
      return;
    }

    if (remoteLastModified > localLastModified) {
      state.spaces = remote.spaces;
      state.lastModified = remoteLastModified;
      github.lastSyncTime = now;
      await saveStateToStorage(state);
      return;
    }

    if (localLastModified > remoteLastModified) {
      await uploadRemoteState(
        github.token,
        github.gistId,
        state.spaces,
        localLastModified,
      );
      github.lastSyncTime = now;
      await saveStateToStorage(state);
      return;
    }
  } catch (error: any) {
    console.error('Gist 自动同步失败:', error?.message || error);
  }
}
