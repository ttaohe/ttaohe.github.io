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

先将经过审阅的源文件提交到 `main`。随后为发布分支创建独立工作目录，避免把源码目录直接当成网页目录发布。

以下示例假设尚不存在 `../homepage-publish`，并且远端已经有 `gh-pages` 分支：

```bash
git fetch origin gh-pages
git worktree add --detach ../homepage-publish origin/gh-pages
rsync -av --delete --exclude=.git publish/ ../homepage-publish/
git -C ../homepage-publish status --short
git -C ../homepage-publish diff --stat
```

`rsync --delete` 会删除目标工作目录中不属于本次输出的旧文件，因此目标必须是专门用于发布的工作目录。核对差异后，提交并推送：

```bash
git -C ../homepage-publish add .
git -C ../homepage-publish commit -m "Publish reviewed homepage"
git -C ../homepage-publish push origin HEAD:gh-pages
```

输出中的 `.nojekyll` 需要保留。发布分支只接收生成结果，不接收源码工作流、草稿或发布凭据。

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
