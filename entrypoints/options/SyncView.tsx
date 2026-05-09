import { useRef, useMemo, useState } from 'react';
import {
  LayoutGrid,
  FolderOpen,
  Link,
  Download,
  Upload,
  Cloud,
  HardDrive,
  Eye,
  EyeOff,
  ArrowUpFromLine,
  ArrowDownToLine,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { useTabStore } from '../../src/store/useTabStore';
import { uploadToWebDAV, downloadFromWebDAV } from '../../src/utils/webdavSync';
import { uploadToGist, downloadFromGist } from '../../src/utils/gistSync';
import { requestHostPermission } from '../../src/utils/permissions';

function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-80">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-9 text-sm border border-gray-200 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function WebDAVSyncButtons() {
  const spaces = useTabStore((state) => state.spaces);
  const replaceSpaces = useTabStore((state) => state.replaceSpaces);
  const syncSettings = useTabStore((state) => state.syncSettings);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleUpload = async () => {
    const { url } = syncSettings.webdav;
    if (!url) {
      alert('请先填写 WebDAV URL');
      return;
    }

    const permitted = await requestHostPermission(url);
    if (!permitted) {
      alert('请允许网络访问权限以便连接 WebDAV');
      return;
    }

    if (
      !window.confirm(
        '警告：这将用当前本地数据完全覆盖远端云盘中的数据，确定继续吗？',
      )
    ) {
      return;
    }

    setUploading(true);
    try {
      await uploadToWebDAV(syncSettings.webdav, spaces);
      useTabStore.getState().updateWebDavLastSyncTime(Date.now());
      alert('上传成功：本地数据已覆盖远端备份');
    } catch (error: any) {
      console.error('WebDAV 上传失败', error);
      alert(
        '上传失败：' +
          (error?.message || '未知错误') +
          '。请确认是否输入了正确的 WebDAV 专属应用密码（通常非登录密码），且网络未被拦截。',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    const { url } = syncSettings.webdav;
    if (!url) {
      alert('请先填写 WebDAV URL');
      return;
    }

    const permitted = await requestHostPermission(url);
    if (!permitted) {
      alert('请允许网络访问权限以便连接 WebDAV');
      return;
    }

    if (
      !window.confirm(
        '警告：这将用云端数据完全覆盖当前本地的标签页数据，确定继续吗？',
      )
    ) {
      return;
    }

    setDownloading(true);
    try {
      const data = await downloadFromWebDAV(syncSettings.webdav);
      replaceSpaces(data);
      const now = Date.now();
      useTabStore.getState().updateWebDavLastSyncTime(now);
      alert('下载成功：云端数据已覆盖本地');
    } catch (error: any) {
      console.error('WebDAV 下载失败', error);
      alert(
        '下载失败：' +
          (error?.message || '未知错误') +
          '。请确认是否输入了正确的 WebDAV 专属应用密码（通常非登录密码），且网络未被拦截。',
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleUpload}
        disabled={uploading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpFromLine size={13} />}
        <span>本地覆盖远程</span>
      </button>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {downloading ? <Loader2 size={13} className="animate-spin" /> : <ArrowDownToLine size={13} />}
        <span>远程覆盖本地</span>
      </button>
    </div>
  );
}

function GistSyncButtons() {
  const spaces = useTabStore((state) => state.spaces);
  const replaceSpaces = useTabStore((state) => state.replaceSpaces);
  const syncSettings = useTabStore((state) => state.syncSettings);
  const updateSyncSettings = useTabStore((state) => state.updateSyncSettings);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleUpload = async () => {
    if (!syncSettings.github.token) {
      alert('请先填写 GitHub Token');
      return;
    }

    if (
      !window.confirm(
        '警告：这将用当前本地数据完全覆盖 GitHub Gist 中的备份数据，确定继续吗？',
      )
    ) {
      return;
    }

    setUploading(true);
    try {
      const gistId = await uploadToGist(syncSettings.github, spaces);
      if (gistId !== syncSettings.github.gistId) {
        updateSyncSettings({
          github: { ...syncSettings.github, gistId },
        });
      }
      useTabStore.getState().updateGistLastSyncTime(Date.now());
      alert('上传成功：本地数据已覆盖 Gist 备份');
    } catch (error: any) {
      console.error('Gist 上传失败', error);
      alert(
        '上传失败：' +
          (error?.message || '未知错误') +
          '。请确认 Token 具有 gist 权限，且网络未被拦截。',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!syncSettings.github.token) {
      alert('请先填写 GitHub Token');
      return;
    }

    if (!syncSettings.github.gistId) {
      alert('尚未创建备份 Gist，请先执行一次上传操作');
      return;
    }

    if (
      !window.confirm(
        '警告：这将用 Gist 中的备份数据完全覆盖当前本地的标签页数据，确定继续吗？',
      )
    ) {
      return;
    }

    setDownloading(true);
    try {
      const data = await downloadFromGist(syncSettings.github);
      replaceSpaces(data);
      useTabStore.getState().updateGistLastSyncTime(Date.now());
      alert('下载成功：Gist 数据已覆盖本地');
    } catch (error: any) {
      console.error('Gist 下载失败', error);
      alert(
        '下载失败：' +
          (error?.message || '未知错误') +
          '。请确认 Token 有效且 Gist 未被删除。',
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleUpload}
        disabled={uploading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpFromLine size={13} />}
        <span>本地覆盖远程</span>
      </button>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {downloading ? <Loader2 size={13} className="animate-spin" /> : <ArrowDownToLine size={13} />}
        <span>远程覆盖本地</span>
      </button>
    </div>
  );
}

export default function SyncView() {
  const spaces = useTabStore((state) => state.spaces);
  const lastModified = useTabStore((state) => state.lastModified);
  const importData = useTabStore((state) => state.importData);
  const setCurrentView = useTabStore((state) => state.setCurrentView);
  const syncSettings = useTabStore((state) => state.syncSettings);
  const updateSyncSettings = useTabStore((state) => state.updateSyncSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const spaceCount = spaces.length;
    const groupCount = spaces.reduce((sum, s) => sum + s.groups.length, 0);
    const tabCount = spaces.reduce(
      (sum, s) =>
        sum + s.groups.reduce((gSum, g) => gSum + g.tabs.length, 0),
      0,
    );
    return { spaceCount, groupCount, tabCount };
  }, [spaces]);

  const handleExport = async () => {
    try {
      const dataStr = JSON.stringify(spaces, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });

      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: `freetab-backup-${new Date().toISOString().slice(0, 10)}.json`,
        types: [
          {
            description: 'JSON 备份文件',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      console.log('导出取消或失败', error);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          importData(data);
        } else {
          alert('文件格式错误：JSON 根节点必须是数组');
        }
      } catch {
        alert('文件解析失败，请检查 JSON 格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      {/* 页面头部 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">备份与同步</h1>
        <p className="text-sm text-gray-500">
          当前数据版本号：{lastModified}，最后修改时间为{' '}
          {formatDateTime(lastModified)}
        </p>
      </div>

      {/* 统计卡片区 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <LayoutGrid size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.spaceCount}
            </p>
            <p className="text-xs text-gray-500">空间数量</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
            <FolderOpen size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.groupCount}
            </p>
            <p className="text-xs text-gray-500">分组数量</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Link size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.tabCount}
            </p>
            <p className="text-xs text-gray-500">标签数量</p>
          </div>
        </div>
      </div>

      {/* 离线同步区 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">离线同步</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-500 mb-4">
            将您的所有数据导出为 JSON 文件进行本地备份，或从备份文件恢复数据。
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
            >
              <Download size={16} />
              <span>导出数据</span>
            </button>
            <button
              onClick={handleImportClick}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <Upload size={16} />
              <span>导入数据</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* 远程同步区 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">远程同步</h2>

        {/* GitHub Gist 同步卡片 */}
        <div className="border border-gray-200 rounded-lg bg-white mb-4 overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center">
                <Cloud size={18} className="text-gray-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    GitHub Gist 同步
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 rounded border border-green-200">
                    Beta
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  通过 GitHub Gist 在多台设备间同步数据
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={syncSettings.github.enabled}
              onChange={(v) =>
                updateSyncSettings({ github: { ...syncSettings.github, enabled: v } })
              }
            />
          </div>

          {syncSettings.github.enabled && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm text-gray-700">GitHub Token</span>
                <PasswordInput
                  value={syncSettings.github.token}
                  onChange={(v) =>
                    updateSyncSettings({ github: { ...syncSettings.github, token: v } })
                  }
                  placeholder="输入 GitHub Token"
                />
              </div>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm text-gray-700">同步方式</span>
                <GistSyncButtons />
              </div>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <span className="text-sm text-gray-700">自动同步</span>
                  {syncSettings.github.lastSyncTime && (
                    <div className="text-xs text-gray-400 mt-1">
                      上次成功同步：
                      {new Date(syncSettings.github.lastSyncTime).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </div>
                  )}
                </div>
                <ToggleSwitch
                  checked={syncSettings.github.autoSync}
                  onChange={(v) => {
                    updateSyncSettings({
                      github: { ...syncSettings.github, autoSync: v },
                    });
                    if (v) {
                      chrome.alarms.create('gist-auto-sync', { periodInMinutes: 15 });
                    } else {
                      chrome.alarms.clear('gist-auto-sync');
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* WebDAV 同步卡片 */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center">
                <HardDrive size={18} className="text-gray-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    WebDAV 同步
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 rounded border border-green-200">
                    Beta
                  </span>
                  <div className="relative group">
                    <HelpCircle size={14} className="text-gray-400 hover:text-gray-600 cursor-help transition-colors" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50">
                      <div className="font-medium mb-1">支持的 WebDAV 服务：</div>
                      <div>坚果云jianguoyun · infini-cloud · teracloud · yandex · box · 4shared</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  通过 WebDAV 协议连接私有云存储
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={syncSettings.webdav.enabled}
              onChange={(v) =>
                updateSyncSettings({ webdav: { ...syncSettings.webdav, enabled: v } })
              }
            />
          </div>

          {syncSettings.webdav.enabled && (
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm text-gray-700">WebDAV URL</span>
                <input
                  type="text"
                  value={syncSettings.webdav.url}
                  onChange={(e) =>
                    updateSyncSettings({
                      webdav: { ...syncSettings.webdav, url: e.target.value },
                    })
                  }
                  placeholder="输入 WebDAV 地址"
                  className="w-80 px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm text-gray-700">WebDAV 用户名</span>
                <input
                  type="text"
                  value={syncSettings.webdav.username}
                  onChange={(e) =>
                    updateSyncSettings({
                      webdav: { ...syncSettings.webdav, username: e.target.value },
                    })
                  }
                  placeholder="输入用户名"
                  className="w-80 px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm text-gray-700">WebDAV 密码</span>
                <PasswordInput
                  value={syncSettings.webdav.password}
                  onChange={(v) =>
                    updateSyncSettings({
                      webdav: { ...syncSettings.webdav, password: v },
                    })
                  }
                  placeholder="应用专用密码"
                />
              </div>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm text-gray-700">同步方式</span>
                <WebDAVSyncButtons />
              </div>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <span className="text-sm text-gray-700">自动同步</span>
                  {syncSettings.webdav.lastSyncTime && (
                    <div className="text-xs text-gray-400 mt-1">
                      上次成功同步：
                      {new Date(syncSettings.webdav.lastSyncTime).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </div>
                  )}
                </div>
                <ToggleSwitch
                  checked={syncSettings.webdav.autoSync}
                  onChange={(v) => {
                    updateSyncSettings({
                      webdav: { ...syncSettings.webdav, autoSync: v },
                    });
                    if (v) {
                      chrome.alarms.create('webdav-auto-sync', { periodInMinutes: 15 });
                    } else {
                      chrome.alarms.clear('webdav-auto-sync');
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 返回按钮 */}
      <div className="mt-8">
        <button
          onClick={() => setCurrentView('home')}
          className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-md transition-colors"
        >
          ← 返回首页
        </button>
      </div>
    </div>
  );
}
