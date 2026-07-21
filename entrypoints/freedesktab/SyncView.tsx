import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
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
  CheckCircle2,
  XCircle,
  Wifi,
} from 'lucide-react';
import { useTabStore } from '../../src/store/useTabStore';
import { getTheme } from '../../src/themes';
import { t } from '../../src/i18n';
import { uploadToWebDAV, downloadFromWebDAV, testWebDAVConnection } from '../../src/utils/webdavSync';
import { uploadToGist, downloadFromGist } from '../../src/utils/gistSync';
import { requestHostPermission, hasHostPermission } from '../../src/utils/permissions';

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

// BUG 4: Track component mount status to prevent setState on unmounted components
function useIsMounted() {
  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);
  return isMounted;
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const theme = useTabStore((state) => state.theme);
  const locale = useTabStore((state) => state.locale);
  const themeColors = getTheme(theme);

  const tr = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) =>
    t(locale, key, params);
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
      style={{ backgroundColor: checked ? '#2563eb' : themeColors.toggleOffBg }}
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
  const theme = useTabStore((state) => state.theme);
  const themeColors = getTheme(theme);
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-80">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-9 text-sm border rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
        style={{ borderColor: themeColors.inputBorder, backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2"
        style={{ color: themeColors.textMuted }}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function WebDAVSyncButtons({ permitted }: { permitted: boolean }) {
  const spaces = useTabStore((state) => state.spaces);
  const replaceSpaces = useTabStore((state) => state.replaceSpaces);
  const syncSettings = useTabStore((state) => state.syncSettings);
  const theme = useTabStore((state) => state.theme);
  const locale = useTabStore((state) => state.locale);
  const themeColors = getTheme(theme);

  const tr = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) =>
    t(locale, key, params);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isMounted = useIsMounted();

  const handleUpload = async () => {
    const { url } = syncSettings.webdav;
    if (!url) {
      alert(tr('pleaseFillUrl'));
      return;
    }

    const permittedNow = await requestHostPermission(url);
    if (!permittedNow) {
      alert(tr('pleaseAllowPermission'));
      return;
    }

    if (
      !window.confirm(
        tr('uploadConfirm'),
      )
    ) {
      return;
    }

    setUploading(true);
    try {
      await uploadToWebDAV(syncSettings.webdav, spaces);
      useTabStore.getState().updateWebDavLastSyncTime(Date.now());
      alert(tr('uploadSuccess'));
    } catch (error: any) {
      console.error('WebDAV upload failed', error);
      alert(
        tr('uploadFailed') + ': ' + (error?.message || tr('unknown')),
      );
    } finally {
      if (isMounted.current) setUploading(false);
    }
  };

  const handleDownload = async () => {
    const { url } = syncSettings.webdav;
    if (!url) {
      alert(tr('pleaseFillUrl'));
      return;
    }

    const permittedNow = await requestHostPermission(url);
    if (!permittedNow) {
      alert(tr('pleaseAllowPermission'));
      return;
    }

    if (
      !window.confirm(
        tr('downloadConfirm'),
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
      alert(tr('downloadSuccess'));
    } catch (error: any) {
      console.error('WebDAV download failed', error);
      alert(
        tr('downloadFailed') + ': ' + (error?.message || tr('unknown')),
      );
    } finally {
      if (isMounted.current) setDownloading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            color: themeColors.buttonSecondaryText,
            backgroundColor: themeColors.buttonSecondaryBg,
            borderColor: themeColors.buttonSecondaryBorder,
          }}
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpFromLine size={13} />}
          <span>{tr('uploadLocalToRemote')}</span>
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            color: themeColors.buttonSecondaryText,
            backgroundColor: themeColors.buttonSecondaryBg,
            borderColor: themeColors.buttonSecondaryBorder,
          }}
        >
          {downloading ? <Loader2 size={13} className="animate-spin" /> : <ArrowDownToLine size={13} />}
          <span>{tr('downloadRemoteToLocal')}</span>
        </button>
      </div>
      {!permitted && (
        <div className="text-xs mt-1.5" style={{ color: '#ef4444' }}>{tr('pleaseTestConnectionFirst')}</div>
      )}
    </div>
  );
}

function GistSyncButtons() {
  const spaces = useTabStore((state) => state.spaces);
  const replaceSpaces = useTabStore((state) => state.replaceSpaces);
  const syncSettings = useTabStore((state) => state.syncSettings);
  const updateSyncSettings = useTabStore((state) => state.updateSyncSettings);
  const theme = useTabStore((state) => state.theme);
  const locale = useTabStore((state) => state.locale);
  const themeColors = getTheme(theme);

  const tr = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) =>
    t(locale, key, params);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isMounted = useIsMounted();

  const handleUpload = async () => {
    if (!syncSettings.github.token) {
      alert(tr('pleaseFillToken'));
      return;
    }

    if (
      !window.confirm(
        tr('uploadConfirm'),
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
      alert(tr('uploadSuccess'));
    } catch (error: any) {
      console.error('Gist upload failed', error);
      alert(
        tr('uploadFailed') + ': ' + (error?.message || tr('unknown')),
      );
    } finally {
      if (isMounted.current) setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!syncSettings.github.token) {
      alert(tr('pleaseFillToken'));
      return;
    }

    if (!syncSettings.github.gistId) {
      alert(tr('noGistCreated'));
      return;
    }

    if (
      !window.confirm(
        tr('downloadConfirm'),
      )
    ) {
      return;
    }

    setDownloading(true);
    try {
      const data = await downloadFromGist(syncSettings.github);
      replaceSpaces(data);
      useTabStore.getState().updateGistLastSyncTime(Date.now());
      alert(tr('downloadSuccess'));
    } catch (error: any) {
      console.error('Gist download failed', error);
      alert(
        tr('downloadFailed') + ': ' + (error?.message || tr('unknown')),
      );
    } finally {
      if (isMounted.current) setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleUpload}
        disabled={uploading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          color: themeColors.buttonSecondaryText,
          backgroundColor: themeColors.buttonSecondaryBg,
          borderColor: themeColors.buttonSecondaryBorder,
        }}
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpFromLine size={13} />}
        <span>{tr('uploadLocalToRemote')}</span>
      </button>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          color: themeColors.buttonSecondaryText,
          backgroundColor: themeColors.buttonSecondaryBg,
          borderColor: themeColors.buttonSecondaryBorder,
        }}
      >
        {downloading ? <Loader2 size={13} className="animate-spin" /> : <ArrowDownToLine size={13} />}
        <span>{tr('downloadRemoteToLocal')}</span>
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
  const theme = useTabStore((state) => state.theme);
  const locale = useTabStore((state) => state.locale);
  const themeColors = getTheme(theme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // WebDAV connection test state
  const [connTestStatus, setConnTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [webdavPermitted, setWebdavPermitted] = useState(true);
  const isMounted = useIsMounted();

  const checkWebdavPermission = useCallback(async (url: string) => {
    if (!url) {
      if (isMounted.current) setWebdavPermitted(true);
      return;
    }
    try {
      const ok = await hasHostPermission(url);
      if (isMounted.current) setWebdavPermitted(ok);
    } catch {
      if (isMounted.current) setWebdavPermitted(true);
    }
  }, [isMounted]);

  useEffect(() => {
    checkWebdavPermission(syncSettings.webdav.url);
  }, [syncSettings.webdav.url, checkWebdavPermission]);

  const handleTestConnection = async () => {
    const { url, username, password } = syncSettings.webdav;
    if (!url || !username || !password) return;
    setConnTestStatus('testing');
    try {
      const ok = await testWebDAVConnection(url, username, password);
      if (!isMounted.current) return;
      setConnTestStatus(ok ? 'success' : 'failed');
      await checkWebdavPermission(url);
    } catch {
      if (isMounted.current) setConnTestStatus('failed');
    }
  };

  const tr = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) =>
    t(locale, key, params);

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
            description: tr('jsonBackupFile'),
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
          alert(tr('importFormatError'));
        }
      } catch {
        alert(tr('importParseError'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      {/* 页面头部 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: themeColors.textPrimary }}>{tr('backupAndSync')}</h1>
        <p className="text-sm" style={{ color: themeColors.textMuted }}>
          {tr('dataVersion')}: {lastModified}{' '}
          {formatDateTime(lastModified)}
        </p>
      </div>

      {/* 统计卡片区 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div
          className="border rounded-lg p-4 flex items-center gap-3"
          style={{ backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <LayoutGrid size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: themeColors.textPrimary }}>
              {stats.spaceCount}
            </p>
            <p className="text-xs" style={{ color: themeColors.textMuted }}>{tr('spaceCount')}</p>
          </div>
        </div>
        <div
          className="border rounded-lg p-4 flex items-center gap-3"
          style={{ backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }}
        >
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
            <FolderOpen size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: themeColors.textPrimary }}>
              {stats.groupCount}
            </p>
            <p className="text-xs" style={{ color: themeColors.textMuted }}>{tr('groupCount')}</p>
          </div>
        </div>
        <div
          className="border rounded-lg p-4 flex items-center gap-3"
          style={{ backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }}
        >
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Link size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: themeColors.textPrimary }}>
              {stats.tabCount}
            </p>
            <p className="text-xs" style={{ color: themeColors.textMuted }}>{tr('tabCount')}</p>
          </div>
        </div>
      </div>

      {/* 离线同步区 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: themeColors.textPrimary }}>{tr('localBackup')}</h2>
        <div
          className="border rounded-lg p-6"
          style={{ backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }}
        >
          <p className="text-sm mb-4" style={{ color: themeColors.textMuted }}>
            {tr('offlineSyncDesc')}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-colors"
              style={{
                backgroundColor: themeColors.buttonPrimaryBg,
                color: themeColors.buttonPrimaryText,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = themeColors.buttonPrimaryHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = themeColors.buttonPrimaryBg;
              }}
            >
              <Download size={16} />
              <span>{tr('exportData')}</span>
            </button>
            <button
              onClick={handleImportClick}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-md transition-colors"
              style={{
                color: themeColors.buttonSecondaryText,
                backgroundColor: themeColors.buttonSecondaryBg,
                borderColor: themeColors.buttonSecondaryBorder,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = themeColors.buttonSecondaryHover;
                e.currentTarget.style.borderColor = themeColors.textMuted;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = themeColors.buttonSecondaryBg;
                e.currentTarget.style.borderColor = themeColors.buttonSecondaryBorder;
              }}
            >
              <Upload size={16} />
              <span>{tr('importData')}</span>
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
        <h2 className="text-lg font-semibold mb-4" style={{ color: themeColors.textPrimary }}>{tr('remoteSync')}</h2>

        {/* GitHub Gist 同步卡片 */}
        <div
          className="border rounded-lg mb-4 overflow-hidden"
          style={{ backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }}
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center"
                style={{ backgroundColor: themeColors.iconBg }}
              >
                <Cloud size={18} className="text-gray-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: themeColors.textPrimary }}>
                    {tr('githubGistSync')}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 rounded border border-green-200">
                    Beta
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: themeColors.textMuted }}>
                  {tr('githubGistDesc')}
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
              <div className="flex items-center justify-between py-3 border-t">
                <span className="text-sm" style={{ color: themeColors.textSecondary }}>GitHub Token</span>
                <PasswordInput
                  value={syncSettings.github.token}
                  onChange={(v) =>
                    updateSyncSettings({ github: { ...syncSettings.github, token: v } })
                  }
                  placeholder={tr('githubTokenPlaceholder')}
                />
              </div>
              <div className="flex items-center justify-between py-3 border-t" style={{ borderColor: themeColors.dividerColor }}>
                <span className="text-sm" style={{ color: themeColors.textSecondary }}>{tr('syncMethod')}</span>
                <GistSyncButtons />
              </div>
              <div className="flex items-center justify-between py-3 border-t" style={{ borderColor: themeColors.dividerColor }}>
                <div>
                  <span className="text-sm" style={{ color: themeColors.textSecondary }}>{tr('autoSync')}</span>
                  <div className="text-xs mt-0.5" style={{ color: themeColors.textMuted }}>
                    {tr('autoSyncInterval')}
                  </div>
                  {syncSettings.github.lastSyncTime && (
                    <div className="text-xs mt-1" style={{ color: themeColors.textMuted }}>
                      {tr('lastSyncTime')}:{' '}
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
        <div
          className="border rounded-lg"
          style={{ backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }}
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center"
                style={{ backgroundColor: themeColors.iconBg }}
              >
                <HardDrive size={18} className="text-gray-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: themeColors.textPrimary }}>
                    {tr('webdavSync')}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 rounded border border-green-200">
                    Beta
                  </span>
                </div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: themeColors.textMuted }}>
                  {tr('webdavSubtitlePrefix')}
                  <span className="relative group inline-flex mx-0.5">
                    <HelpCircle size={11} className="cursor-help transition-colors" style={{ color: themeColors.textMuted }} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50" style={{ backgroundColor: themeColors.tooltipBg }}>
                      <div className="font-medium mb-1">{tr('webdavSupportedServices')}</div>
                      <div>{tr('webdavServiceList')}</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent" style={{ borderTopColor: themeColors.tooltipBg }}></div>
                    </div>
                  </span>
                  {tr('webdavSubtitleSuffix')}
                </div>
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
              <div className="flex items-center justify-between py-3 border-t" style={{ borderColor: themeColors.dividerColor }}>
                <span className="text-sm" style={{ color: themeColors.textSecondary }}>WebDAV URL</span>
                <input
                  type="text"
                  value={syncSettings.webdav.url}
                  onChange={(e) =>
                    updateSyncSettings({
                      webdav: { ...syncSettings.webdav, url: e.target.value },
                    })
                  }
                  placeholder={tr('webdavUrlPlaceholder')}
                  className="w-80 px-3 py-2 text-sm border rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  style={{ borderColor: themeColors.inputBorder, backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }}
                />
              </div>
              <div className="flex items-center justify-between py-3 border-t" style={{ borderColor: themeColors.dividerColor }}>
                <span className="text-sm" style={{ color: themeColors.textSecondary }}>{tr('webdavUsername')}</span>
                <input
                  type="text"
                  value={syncSettings.webdav.username}
                  onChange={(e) =>
                    updateSyncSettings({
                      webdav: { ...syncSettings.webdav, username: e.target.value },
                    })
                  }
                  placeholder={tr('webdavUsernamePlaceholder')}
                  className="w-80 px-3 py-2 text-sm border rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  style={{ borderColor: themeColors.inputBorder, backgroundColor: themeColors.inputBg, color: themeColors.textPrimary }}
                />
              </div>
              <div className="flex items-center justify-between py-3 border-t" style={{ borderColor: themeColors.dividerColor }}>
                <span className="text-sm" style={{ color: themeColors.textSecondary }}>{tr('webdavPassword')}</span>
                <PasswordInput
                  value={syncSettings.webdav.password}
                  onChange={(v) =>
                    updateSyncSettings({
                      webdav: { ...syncSettings.webdav, password: v },
                    })
                  }
                  placeholder={tr('webdavPasswordPlaceholder')}
                />
              </div>
              <div className="flex items-center justify-between py-3 border-t" style={{ borderColor: themeColors.dividerColor }}>
                <span className="text-sm" style={{ color: themeColors.textSecondary }}>{tr('webdavConnectionTest')}</span>
                <div className="flex items-center gap-2">
                  {connTestStatus === 'success' && (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#16a34a' }}>
                      <CheckCircle2 size={14} />
                      {tr('connectionSuccess')}
                    </span>
                  )}
                  {connTestStatus === 'failed' && (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#ef4444' }}>
                      <XCircle size={14} />
                      {tr('connectionFailed')}
                    </span>
                  )}
                  {connTestStatus === 'testing' && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: themeColors.textMuted }}>
                      <Loader2 size={14} className="animate-spin" />
                      {tr('connectionTesting')}
                    </span>
                  )}
                  <button
                    onClick={handleTestConnection}
                    disabled={connTestStatus === 'testing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      color: themeColors.buttonSecondaryText,
                      backgroundColor: themeColors.buttonSecondaryBg,
                      borderColor: themeColors.buttonSecondaryBorder,
                    }}
                  >
                    <Wifi size={13} />
                    <span>{tr('testConnection')}</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-t" style={{ borderColor: themeColors.dividerColor }}>
                <span className="text-sm" style={{ color: themeColors.textSecondary }}>{tr('manualSync')}</span>
                <WebDAVSyncButtons permitted={webdavPermitted} />
              </div>
              <div className="flex items-center justify-between py-3 border-t" style={{ borderColor: themeColors.dividerColor }}>
                <div>
                  <span className="text-sm" style={{ color: themeColors.textSecondary }}>{tr('autoSync')}</span>
                  <div className="text-xs mt-0.5" style={{ color: themeColors.textMuted }}>
                    {tr('autoSyncInterval')}
                  </div>
                  {syncSettings.webdav.autoSync && !webdavPermitted && (
                    <div className="text-xs mt-1" style={{ color: '#ef4444' }}>{tr('pleaseTestConnectionFirst')}</div>
                  )}
                  {syncSettings.webdav.lastSyncTime && (
                    <div className="text-xs mt-1" style={{ color: themeColors.textMuted }}>
                      {tr('lastSyncTime')}:{' '}
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
          ← {tr('backToHome')}
        </button>
      </div>
    </div>
  );
}
