import { performWebDAVAutoSync } from '../src/utils/webdavBackground';
import { performGistAutoSync } from '../src/utils/gistBackground';

export default defineBackground(() => {
  chrome.action.onClicked.addListener(async () => {
    const extensionUrl = chrome.runtime.getURL('/options.html');

    try {
      const tabs = await chrome.tabs.query({ url: extensionUrl });

      if (tabs.length > 0 && tabs[0].id && tabs[0].windowId) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: extensionUrl });
      }
    } catch (error) {
      console.error('切换标签页失败，降级为新建标签页:', error);
      await chrome.tabs.create({ url: extensionUrl });
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
