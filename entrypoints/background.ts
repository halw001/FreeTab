import { performWebDAVAutoSync } from '../src/utils/webdavBackground';
import { performGistAutoSync } from '../src/utils/gistBackground';

const STORAGE_KEY = 'freetab-store-v2';

/**
 * 扩展更新 / 浏览器重启后 SW 重新启动时，chrome.alarms 会被清空（Chrome MV3 行为），
 * 但 syncSettings.autoSync 仍保存在 chrome.storage.local 中。
 * 这里在 SW 启动时检查 autoSync 标志，若对应 alarm 不存在则重建，
 * 避免用户以为自动同步开着，实际却不触发的"静默失效"问题。
 */
async function restoreAlarms(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const state = result[STORAGE_KEY];
    if (!state?.syncSettings) return;

    const { github, webdav } = state.syncSettings;

    if (github?.autoSync && github?.token) {
      const existing = await chrome.alarms.get('gist-auto-sync');
      if (!existing) {
        // delayInMinutes: 0.5 让首次同步在 ~30 秒后触发
        chrome.alarms.create('gist-auto-sync', {
          periodInMinutes: 15,
          delayInMinutes: 0.5,
        });
        console.log('[restoreAlarms] recreated gist-auto-sync');
      }
    }

    if (
      webdav?.autoSync &&
      webdav?.url &&
      webdav?.username &&
      webdav?.password
    ) {
      const existing = await chrome.alarms.get('webdav-auto-sync');
      if (!existing) {
        chrome.alarms.create('webdav-auto-sync', {
          periodInMinutes: 15,
          delayInMinutes: 0.5,
        });
        console.log('[restoreAlarms] recreated webdav-auto-sync');
      }
    }
  } catch (e: any) {
    console.error('[restoreAlarms] failed:', e?.message || e);
  }
}

export default defineBackground(() => {
  // SW 启动时恢复可能丢失的 alarm（扩展更新 / 浏览器重启后）
  void restoreAlarms();

  // 并发锁：防止连续点击图标时多个 onClicked 事件同时创建 dashboard tab
  let isOpeningDashboard = false;

  chrome.action.onClicked.addListener(async (tab) => {
    if (isOpeningDashboard) return;
    isOpeningDashboard = true;

    try {
      const extensionUrl = chrome.runtime.getURL('/freedesktab.html');

      // 不用 chrome.tabs.query 的 url 过滤参数（对 chrome-extension:// URL
      // 在部分浏览器如 360 极速不兼容，会抛错或返回空），改为查询当前窗口所有
      // tab 后手动匹配 url / pendingUrl
      const allTabs = await chrome.tabs.query({ windowId: tab.windowId });
      const existing = allTabs.find(
        (t) => t.url === extensionUrl || t.pendingUrl === extensionUrl,
      );

      if (existing?.id) {
        await chrome.tabs.update(existing.id, { active: true });
      } else {
        await chrome.tabs.create({ url: extensionUrl });
      }
    } catch (error) {
      console.error('打开 dashboard 失败，降级为新建标签页:', error);
      try {
        await chrome.tabs.create({ url: chrome.runtime.getURL('/freedesktab.html') });
      } catch {
        // ignore
      }
    } finally {
      // 延迟释放锁，确保新创建的 tab 已注册到 chrome.tabs，
      // 后续点击能正确走「激活已有 tab」分支
      setTimeout(() => {
        isOpeningDashboard = false;
      }, 500);
    }
  });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'webdav-auto-sync') {
      try {
        await performWebDAVAutoSync();
      } catch (error: any) {
        console.error('WebDAV auto-sync 未捕获异常:', error?.message || error);
      }
    }

    if (alarm.name === 'gist-auto-sync') {
      try {
        await performGistAutoSync();
      } catch (error: any) {
        console.error('Gist auto-sync 未捕获异常:', error?.message || error);
      }
    }
  });

  // 扩展安装/更新时触发一次恢复（onInstalled 事件在 SW 首次启动后才能注册）
  chrome.runtime.onInstalled.addListener(() => {
    void restoreAlarms();
  });
});
