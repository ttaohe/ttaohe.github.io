# 预览与发布

需 Node.js 24、Git 和已登录的 GitHub CLI。
main 是源码，gh-pages 是发布结果；Actions 保持关闭。

## 生成与检查

```bash
node scripts/prepare-publish.mjs
node scripts/finalize-homepage.mjs
node --test scripts/portfolio-*.test.mjs
node scripts/check-maintenance.mjs
python3 -m http.server 4173 --directory publish
```

打开 http://localhost:4173，检查本次改动、窄屏、主题、链接和 PDF。
改 portfolio/、lib/blog/ 等源文件，不直接改生成目录。

## 发布

先提交审阅后的源码，保持工作目录干净：

```bash
node scripts/publish-homepage.mjs
node scripts/publish-homepage.mjs --apply
```

第一条只展示差异，确认后执行第二条。工具只操作本仓库，对齐完整输出，不强推，不发布草稿或凭据。保留 .nojekyll 和 CNAME；旧版本由 Git 恢复。

Pages 设置：Deploy from a branch → gh-pages → /。
域名为 www.ttaoai.cn，启用 HTTPS。检查线上页面与资源版本，不能只以提交成功判断上线。

如未自动重建：

```bash
gh api --method POST repos/ttaohe/ttaohe.github.io/pages/builds
```

也可在已登录网页手动提交 .nojekyll 触发平台构建，不必启用仓库工作流。

## 同步简历

先在 resume-ng 提交并核验源码与 PDF：

```bash
node scripts/sync-resume.mjs ../resume-ng
node scripts/sync-resume.mjs ../resume-ng --apply
```

第一条预览，第二条更新 PDF 副本与 source.json，不直接发布网站。

正文与日报按各自审阅流程发布；主页发布不代表发布新一期日报。
域名配置在 lib/site-config.json；变更时检查导航、文章及旧链接。私有运维信息另存，勿写入公开文档。
