import { performWebDAVAutoSync } from '../src/utils/webdavBackground';
import { performGistAutoSync } from '../src/utils/gistBackground';

export default defineBackground(() => {
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
});
