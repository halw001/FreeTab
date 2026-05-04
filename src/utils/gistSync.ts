import type { Space } from '../types';
import type { SyncSettings } from '../store/useTabStore';

const GIST_API = 'https://api.github.com/gists';
const FILE_NAME = 'freetab_backup.json';

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
): Promise<string> {
  const { token, gistId } = settings;
  if (!token) {
    throw new Error('GitHub Token 未配置');
  }

  const jsonData = JSON.stringify(spacesData, null, 2);
  const payload = {
    files: {
      [FILE_NAME]: { content: jsonData },
    },
  };

  if (gistId) {
    const res = await fetch(`${GIST_API}/${gistId}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`更新 Gist 失败 (${res.status}): ${body}`);
    }

    return gistId;
  }

  const res = await fetch(GIST_API, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      ...payload,
      description: 'FreeTab Backup',
      public: false,
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

export async function downloadFromGist(
  settings: SyncSettings['github'],
): Promise<Space[]> {
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
    const body = await res.text();
    throw new Error(`获取 Gist 失败 (${res.status}): ${body}`);
  }

  const data = await res.json();
  const file = data.files?.[FILE_NAME];
  if (!file || !file.content) {
    throw new Error(`Gist 中未找到 ${FILE_NAME} 文件`);
  }

  const parsed = JSON.parse(file.content);
  if (!Array.isArray(parsed)) {
    throw new Error('Gist 备份文件格式错误：根节点必须是数组');
  }

  return parsed as Space[];
}
