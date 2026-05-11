import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'FreeTab',
    default_locale: 'en',
    action: {
      default_popup: undefined,
    },
    permissions: ['alarms', 'storage'],
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
