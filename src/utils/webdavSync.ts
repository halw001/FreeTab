import type { Space } from '../types';
import type { SyncSettings } from '../store/useTabStore';
import { requestHostPermission } from './permissions';
import {
  webdavExists,
  webdavMkcol,
  webdavGet,
  webdavPut,
  webdavTestConnection,
  basicAuth,
} from './webdavClient';

const REMOTE_DIR = '/freetab';
const REMOTE_FILE = '/freetab/backup.json';

/**
 * 统一的备份文件格式（与 Gist / 本地备份一致）。
 * 老的纯数组格式 [...spaces] 在下载时仍会兼容。
 */
export interface WebDAVBackup {
  spaces: Space[];
  lastModified: number;
}

export async function uploadToWebDAV(
  settings: SyncSettings['webdav'],
  spacesData: Space[],
  lastModified: number,
): Promise<void> {
  const { url, username, password } = settings;
  if (!url || !username || !password) {
    throw new Error('WebDAV 配置不完整，请检查 URL、用户名和密码');
  }

  const permitted = await requestHostPermission(url);
  if (!permitted) {
    throw new Error('权限被拒绝：无法访问该 WebDAV 服务器');
  }

  const auth = basicAuth(username, password);

  const exists = await webdavExists(url, REMOTE_DIR, auth);
  if (!exists) {
    await webdavMkcol(url, REMOTE_DIR, auth);
  }

  // lastModified 由调用方传入，确保本地与远端时间戳一致，避免下次自动同步误判
  const payload: WebDAVBackup = { spaces: spacesData, lastModified };
  const jsonData = JSON.stringify(payload, null, 2);
  await webdavPut(url, REMOTE_FILE, jsonData, auth);
}

export async function testWebDAVConnection(
  url: string,
  username: string,
  password: string,
): Promise<boolean> {
  if (!url || !username || !password) return false;

  const permitted = await requestHostPermission(url);
  if (!permitted) return false;

  return await webdavTestConnection(url, username, password);
}

export async function downloadFromWebDAV(
  settings: SyncSettings['webdav'],
): Promise<WebDAVBackup> {
  const { url, username, password } = settings;
  if (!url || !username || !password) {
    throw new Error('WebDAV 配置不完整，请检查 URL、用户名和密码');
  }

  const permitted = await requestHostPermission(url);
  if (!permitted) {
    throw new Error('权限被拒绝：无法访问该 WebDAV 服务器');
  }

  const auth = basicAuth(username, password);
  const content = await webdavGet(url, REMOTE_FILE, auth);

  const data = JSON.parse(content);

  // 兼容两种格式：
  // - 新格式（对象）：{ spaces: [...], lastModified: number }
  // - 老格式（数组）：[...spaces]
  let spaces: Space[];
  let lastModified: number | undefined;

  if (Array.isArray(data)) {
    spaces = data as Space[];
  } else if (data && typeof data === 'object') {
    spaces = data.spaces ?? [];
    if (typeof data.lastModified === 'number') {
      lastModified = data.lastModified;
    }
  } else {
    throw new Error('远程备份文件格式错误：既不是数组也不是对象');
  }

  if (!Array.isArray(spaces)) {
    throw new Error('远程备份中 spaces 字段不是数组');
  }

  if (lastModified === undefined) {
    // 老格式无 lastModified，用当前时间作为 fallback，避免误判远端比本地旧
    lastModified = Date.now();
  }

  return { spaces, lastModified };
}
