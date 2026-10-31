# 本地预览与手动发布

[返回 README](../README.md) · [网站设计](ARCHITECTURE.md) · [内容维护](CONTENT-MAINTENANCE.md)

## 先了解当前发布方式

个人主页源码保存在 `main`，生成后的网页保存在 `gh-pages`。GitHub Pages 从发布分支读取静态文件，仓库 Actions 保持关闭。

因此，提交源码与更新线上页面是两件事。本指南先生成可以检查的页面，再介绍如何发布已经审阅的结果。平台内置的 Pages 构建仍可能产生记录，它与执行本仓库中的工作流不同。

## 在本地生成主页

需要 Node.js 24；下面的主页生成步骤只使用 Node 标准库，读取仓库内已有的内容快照。

```bash
node scripts/prepare-publish.mjs
node scripts/finalize-homepage.mjs
node --test scripts/portfolio-*.test.mjs
node scripts/check-maintenance.mjs
```

生成结果位于 `publish/`。它是构建输出，下一次生成时会被重建，文字和样式修改应回到 `portfolio/`，内容快照修改应回到 `lib/blog/`。

预览页面可以使用 Python 的静态文件服务：

```bash
python3 -m http.server 4173 --directory publish
```

打开 `http://localhost:4173`。这里预览的是个人主页和兼容入口，外部文章链接仍按站点配置跳转，完整研究站不会随这个命令一起启动。

## 检查即将发布的内容

先查看本次修改对应的页面，再检查章节导航、主题、窄屏布局、文章入口和 PDF 下载。改动资源后，确认页面引用的文件确实存在。

如果修改了简历，从生成目录中打开 PDF，确认内容与可编辑源文件一致。源码检查通过不能代替查看最终文档。

## 更新发布分支

先提交经过审阅的源码，确保工作目录干净。发布工具需要 Git 和已登录的 GitHub CLI，且只允许操作本主页仓库。

```bash
node scripts/publish-homepage.mjs
```

默认只检查、重新生成页面并展示发布差异，不推送。核对 publish/ 中的页面和差异后，再明确执行：

```bash
node scripts/publish-homepage.mjs --apply
```

工具使用自己创建的临时工作目录准备 gh-pages，随后对齐到本次完整生成结果，保留 .nojekyll，不携带源码工作流、草稿或凭据。临时目录在操作结束后清理；不会强制推送，也不会覆盖未提交的源码。旧资源版本通过 Git 保留，不在当前发布目录里无限累积。

## 同步简历发布副本

先在独立简历仓库中完成正文修改、PDF 编译与检查，并提交对应文件。然后在本仓库中查看将同步的来源：

```bash
node scripts/sync-resume.mjs ../resume-ng
node scripts/sync-resume.mjs ../resume-ng --apply
```

此操作更新固定的 PDF 路径与 source.json，记录来源仓库提交和 PDF 校验值，不发布网站。主页改动审阅并提交后，再执行发布步骤。源文件有未提交改动时，工具会拒绝同步，避免记录与实际内容不一致。

## 确认线上版本

GitHub Pages 应使用 **Deploy from a branch**，分支为 `gh-pages`，目录为仓库根目录。发布后查看 Pages 状态，再打开主页和 PDF 核对实际结果。必要时，已配置 GitHub CLI 的维护者可以请求平台重新构建：

```bash
gh api --method POST repos/ttaohe/ttaohe.github.io/pages/builds
```

如果没有生成新的页面，不要只凭一次成功的 Git 提交认定发布已完成。可以从线上 HTML 引用的资源版本、页面正文与实际下载到的 PDF 逐项确认。

## 研究内容与站点配置

研究笔记和日报采用独立的内容维护流程，完成审阅后再更新公开快照。个人主页读取已确认的摘要，发布主页不代表同时发布一份新的日报。

[`lib/site-config.json`](../lib/site-config.json) 定义站点与内容链接的目标。迁移域名时，需要一并检查首页按钮、文章入口和兼容跳转。具体托管环境、认证和恢复操作由维护者单独管理，本地预览无需这些配置权限。

旧工作流和早期研究站源码仍保留在仓库中，便于追溯历史实现；它们不改变本指南描述的手动发布方式。
