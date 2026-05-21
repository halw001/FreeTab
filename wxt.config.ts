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
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    action: {
      default_popup: undefined,
      default_title: '__MSG_actionTitle__',
      default_icon: {
        '16': 'icon/16.png',
        '24': 'icon/24.png',
        '32': 'icon/32.png',
      },
    },
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
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
