import { createClient } from 'webdav';
import type { Space } from '../types';
import type { SyncSettings } from '../store/useTabStore';
import { requestHostPermission } from './permissions';

const REMOTE_DIR = '/freetab';
const REMOTE_FILE = '/freetab/backup.json';

export async function uploadToWebDAV(
  settings: SyncSettings['webdav'],
  spacesData: Space[],
): Promise<void> {
  const { url, username, password } = settings;
  if (!url || !username || !password) {
    throw new Error('WebDAV 配置不完整，请检查 URL、用户名和密码');
  }

  const permitted = await requestHostPermission(url);
  if (!permitted) {
    throw new Error('权限被拒绝：无法访问该 WebDAV 服务器');
  }

  const client = createClient(url, { username, password });

  const exists = await client.exists(REMOTE_DIR);
  if (!exists) {
    await client.createDirectory(REMOTE_DIR);
  }

  const payload = { spaces: spacesData, lastModified: Date.now() };
  const jsonData = JSON.stringify(payload, null, 2);
  await client.putFileContents(REMOTE_FILE, jsonData, {
    overwrite: true,
  });
}

export async function testWebDAVConnection(
  url: string,
  username: string,
  password: string,
): Promise<boolean> {
  if (!url || !username || !password) return false;

  const permitted = await requestHostPermission(url);
  if (!permitted) return false;

  const client = createClient(url, { username, password });
  await client.getDirectoryContents('/');
  return true;
}

export async function downloadFromWebDAV(
  settings: SyncSettings['webdav'],
): Promise<Space[]> {
  const { url, username, password } = settings;
  if (!url || !username || !password) {
    throw new Error('WebDAV 配置不完整，请检查 URL、用户名和密码');
  }

  const permitted = await requestHostPermission(url);
  if (!permitted) {
    throw new Error('权限被拒绝：无法访问该 WebDAV 服务器');
  }

  const client = createClient(url, { username, password });

  const content = await client.getFileContents(REMOTE_FILE, {
    format: 'text',
  });

  if (typeof content !== 'string') {
    throw new Error('下载的文件内容格式不正确');
  }

  const data = JSON.parse(content);

  let spaces: Space[];

  if (Array.isArray(data)) {
    spaces = data as Space[];
  } else if (data && typeof data === 'object') {
    spaces = data.spaces ?? [];
  } else {
    throw new Error('远程备份文件格式错误：既不是数组也不是对象');
  }

  if (!Array.isArray(spaces)) {
    throw new Error('远程备份中 spaces 字段不是数组');
  }

  return spaces;
}
