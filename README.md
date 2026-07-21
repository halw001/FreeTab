<p align="center">
  <img src="public/icon/128.png" alt="FreeTab" width="128" height="128" />
</p>

<h1 align="center">FreeTab</h1>

<p align="center">A free-forever tab manager with local backups and cloud sync via GitHub Gist & WebDAV.</p>

<p align="center">
  <a href="./README_CN.md">简体中文</a>
  ·
  <a href="./README.md">English</a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/freetab-%E6%B0%B8%E4%B9%85%E5%85%8D%E8%B4%B9%E7%9A%84%E6%A0%87%E7%AD%BE%E9%A1%B5%E4%BF%9D%E5%AD%98%E4%B8%8E%E5%90%8C%E6%AD%A5%E5%B7%A5%E5%85%B7/gabgkiijkknhpphgpolilfmccdmdnaol">
    <img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome%20Web%20Store-Install-blue?logo=googlechrome&logoColor=white" />
  </a>
  <a href="./LICENSE">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg" />
  </a>
</p>

---

## Features

- **Tab Management** — Save, organize and restore open tabs with drag-and-drop. Group tabs into spaces and tab groups for a tidy workflow.
- **Spaces & Groups** — Multiple spaces, each with its own tab groups. Pin frequently used tabs for quick access.
- **Cloud Sync** — Keep your data in sync across devices via **GitHub Gist** or **WebDAV**.
- **Local Backup** — Export and import all data as a JSON file for offline backups.
- **Auto Sync** — Automatically syncs with the remote backup every 15 minutes.
- **Themes** — 6 built-in themes (Default, Dark, Forest, Ocean, Sunset, Sakura).
- **Multilingual** — 15 supported languages.
- **Search** — Quickly find any saved tab across all spaces.
- **Free Forever** — No accounts, no subscriptions, no tracking.

## Supported WebDAV Services

- jianguoyun (坚果云)
- Infini-Cloud
- TeraCloud
- Yandex
- Box
- 4shared
- Koofr
- And any custom WebDAV server (permission requested on first connect)

## Download

Install from the Chrome Web Store:

👉 [FreeTab on Chrome Web Store](https://chromewebstore.google.com/detail/freetab-%E6%B0%B8%E4%B9%85%E5%85%8D%E8%B4%B9%E7%9A%84%E6%A0%87%E7%AD%BE%E9%A1%B5%E4%BF%9D%E5%AD%98%E4%B8%8E%E5%90%8C%E6%AD%A5%E5%B7%A5%E5%85%B7/gabgkiijkknhpphgpolilfmccdmdnaol)

## Tech Stack

- [WXT](https://wxt.dev/) — Next-gen Web Extension framework
- React 19 + TypeScript
- Tailwind CSS v4
- Zustand
- @dnd-kit
- webdav

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Package for store upload
npm run zip
```

## Contributing

This project does **not** accept pull requests. If you need a feature or want to customize the behavior, please **fork** the repository and maintain your own version.

## License

[MIT](./LICENSE) © 2026 halw001
