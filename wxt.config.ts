import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    action: {
      default_popup: undefined,
      default_title: '__MSG_actionTitle__',
    },
    permissions: ['alarms', 'storage', 'tabs'],
    optional_host_permissions: ['*://*/*'],
    host_permissions: [
      '*://*.jianguoyun.com/*',
      '*://*.infini-cloud.net/*',
      '*://*.teracloud.jp/*',
      '*://webdav.yandex.com/*',
      '*://dav.box.com/*',
      '*://*.4shared.com/*',
      '*://api.github.com/*',
    ],
  },
});
