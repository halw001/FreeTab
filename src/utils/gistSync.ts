import type { Space } from '../types';
import type { SyncSettings } from '../store/useTabStore';

const GIST_API = 'https://api.github.com/gists';
const FILE_NAME = 'freetab_backup.json';

/**
 * 统一的备份文件格式（与 WebDAV / 本地备份一致）。
 * 老的纯数组格式 [...spaces] 在下载/导入时仍会兼容。
 */
export interface GistBackup {
  spaces: Space[];
  lastModified: number;
}

function headers(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

export async function uploadToGist(
  settings: SyncSettings['github'],
  spacesData: Space[],
  lastModified: number,
): Promise<string> {
  const { token, gistId } = settings;
  if (!token) {
    throw new Error('GitHub Token 未配置');
  }

  // 统一使用对象格式 { spaces, lastModified }，与 WebDAV 和自动同步保持一致
  const payload: GistBackup = { spaces: spacesData, lastModified };
  const jsonData = JSON.stringify(payload, null, 2);
  const body = {
    files: {
      [FILE_NAME]: { content: jsonData },
    },
  };

  if (gistId) {
    const res = await fetch(`${GIST_API}/${gistId}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`更新 Gist 失败 (${res.status}): ${errBody}`);
    }

    return gistId;
  }

  const res = await fetch(GIST_API, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      ...body,
      description: 'FreeTab Backup',
      public: false,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`创建 Gist 失败 (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const newGistId: string = data.id;
  if (!newGistId) {
    throw new Error('创建 Gist 成功但未返回 ID');
  }

  return newGistId;
}

export async function downloadFromGist(
  settings: SyncSettings['github'],
): Promise<GistBackup> {
  const { token, gistId } = settings;
  if (!token) {
    throw new Error('GitHub Token 未配置');
  }
  if (!gistId) {
    throw new Error('尚未创建备份 Gist，请先执行一次上传');
  }

  const res = await fetch(`${GIST_API}/${gistId}`, {
    method: 'GET',
    headers: headers(token),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`获取 Gist 失败 (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const file = data.files?.[FILE_NAME];
  if (!file || !file.content) {
    throw new Error(`Gist 中未找到 ${FILE_NAME} 文件`);
  }

  const parsed = JSON.parse(file.content);

  // 兼容两种格式：
  // - 新格式（对象）：{ spaces: [...], lastModified: number }
  // - 老格式（数组）：[...spaces]
  let spaces: Space[];
  let lastModified: number | undefined;

  if (Array.isArray(parsed)) {
    spaces = parsed as Space[];
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.spaces)) {
      spaces = obj.spaces as Space[];
      if (typeof obj.lastModified === 'number') {
        lastModified = obj.lastModified;
      }
    } else {
      throw new Error('Gist 备份文件格式错误：缺少 spaces 字段');
    }
  } else {
    throw new Error('Gist 备份文件格式错误：既不是数组也不是对象');
  }

  if (lastModified === undefined) {
    // 老格式无 lastModified，用当前时间作为 fallback，避免误判远端比本地旧
    lastModified = Date.now();
  }

  return { spaces, lastModified };
}
