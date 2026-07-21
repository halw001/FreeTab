<p align="center">
  <img src="public/icon/128.png" alt="FreeTab" width="128" height="128" />
</p>

<h1 align="center">FreeTab</h1>

<p align="center">永久免费的标签页保存与同步工具，支持本地备份与通过 GitHub Gist / WebDAV 云端同步。</p>

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="./README_CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/freetab-%E6%B0%B8%E4%B9%85%E5%85%8D%E8%B4%B9%E7%9A%84%E6%A0%87%E7%AD%BE%E9%A1%B5%E4%BF%9D%E5%AD%98%E4%B8%8E%E5%90%8C%E6%AD%A5%E5%B7%A5%E5%85%B7/gabgkiijkknhpphgpolilfmccdmdnaol">
    <img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome%20Web%20Store-%E5%AE%89%E8%A3%85-blue?logo=googlechrome&logoColor=white" />
  </a>
  <a href="./LICENSE">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg" />
  </a>
</p>

---

## 功能特性

- **标签页管理** — 拖拽保存、整理和恢复当前打开的标签页。支持将标签页分组到空间和标签组中，保持工作区整洁。
- **空间与分组** — 多空间设计，每个空间拥有独立的标签组。常用标签可置顶，方便快速访问。
- **云端同步** — 通过 **GitHub Gist** 或 **WebDAV** 在多设备间同步数据。
- **本地备份** — 支持将全部数据导出为 JSON 文件，或从备份文件恢复。
- **自动同步** — 每 15 分钟自动与远端备份同步一次。
- **主题外观** — 内置 6 套主题（默认、暗黑、森林、海洋、夕阳、樱花）。
- **多语言** — 支持 15 种语言。
- **快速搜索** — 跨所有空间快速查找任意已保存的标签页。
- **永久免费** — 无需注册账号、无订阅、无任何追踪。

## 支持的 WebDAV 服务

- 坚果云（jianguoyun）
- Infini-Cloud
- TeraCloud
- Yandex
- Box
- 4shared
- Koofr
- 以及任意自建 WebDAV 服务器（首次连接时申请权限）

## 下载安装

从 Chrome 应用商店安装：

👉 [Chrome 应用商店 - FreeTab](https://chromewebstore.google.com/detail/freetab-%E6%B0%B8%E4%B9%85%E5%85%8D%E8%B4%B9%E7%9A%84%E6%A0%87%E7%AD%BE%E9%A1%B5%E4%BF%9D%E5%AD%98%E4%B8%8E%E5%90%8C%E6%AD%A5%E5%B7%A5%E5%85%B7/gabgkiijkknhpphgpolilfmccdmdnaol)

## 技术栈

- [WXT](https://wxt.dev/) — 下一代浏览器扩展开发框架
- React 19 + TypeScript
- Tailwind CSS v4
- Zustand
- @dnd-kit
- webdav

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 打包上架
npm run zip
```

## 贡献说明

本项目**不接受** PR。如有需要，欢迎 **fork** 仓库后自行维护和修改。

## 开源协议

[MIT](./LICENSE) © 2026 halw001
