// WebDAV 操作用 fetch 直接实现，避免引入 132KB 的 webdav 包
// 拖慢 Service Worker 启动和 dashboard 加载

function joinPath(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, '') + path;
}

function basicAuth(username: string, password: string): string {
  // 支持 Unicode 字符（MDN 推荐写法）
  return 'Basic ' + btoa(unescape(encodeURIComponent(`${username}:${password}`)));
}

export async function webdavExists(
  baseUrl: string,
  path: string,
  auth: string,
): Promise<boolean> {
  try {
    const res = await fetch(joinPath(baseUrl, path), {
      method: 'PROPFIND',
      headers: { Authorization: auth, Depth: '0' },
    });
    // 207 Multi-Status 或 200 表示存在；404 表示不存在
    return res.status === 207 || res.status === 200;
  } catch {
    return false;
  }
}

export async function webdavMkcol(
  baseUrl: string,
  path: string,
  auth: string,
): Promise<void> {
  const res = await fetch(joinPath(baseUrl, path), {
    method: 'MKCOL',
    headers: { Authorization: auth },
  });
  // 201 Created 成功；405 表示目录已存在，忽略
  if (!res.ok && res.status !== 405) {
    throw new Error(`创建目录失败: ${res.status} ${res.statusText}`);
  }
}

export async function webdavGet(
  baseUrl: string,
  path: string,
  auth: string,
): Promise<string> {
  const res = await fetch(joinPath(baseUrl, path), {
    method: 'GET',
    headers: { Authorization: auth },
  });
  if (!res.ok) {
    throw new Error(`获取文件失败: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

export async function webdavPut(
  baseUrl: string,
  path: string,
  content: string,
  auth: string,
): Promise<void> {
  const res = await fetch(joinPath(baseUrl, path), {
    method: 'PUT',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: content,
  });
  if (!res.ok) {
    throw new Error(`上传文件失败: ${res.status} ${res.statusText}`);
  }
}

// 测试连接：PROPFIND 根目录，只要服务器响应 WebDAV 方法即认为连接正常
export async function webdavTestConnection(
  baseUrl: string,
  username: string,
  password: string,
): Promise<boolean> {
  try {
    const auth = basicAuth(username, password);
    const res = await fetch(joinPath(baseUrl, '/'), {
      method: 'PROPFIND',
      headers: { Authorization: auth, Depth: '1' },
    });
    // 207 Multi-Status 是标准 WebDAV 响应；部分服务器返回 200
    return res.status === 207 || res.status === 200;
  } catch {
    return false;
  }
}

export { basicAuth };
