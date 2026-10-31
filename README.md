# TaoHe · 个人主页

个人介绍、经历、研究入口与 PDF 简历。关注 LLM Inference。

[主页](https://www.ttaoai.cn/) · [研究站](https://lab.ttaoai.cn/) · [发布](docs/MANUAL-PUBLISHING.md) · [待办](ROADMAP.md)

| 位置 | 用途 |
| --- | --- |
| portfolio/index.html | 页面结构与文字 |
| portfolio/styles.css | 排版与主题 |
| portfolio/ui.mjs | 主题、导航与交互 |
| portfolio/resume/ | PDF 发布副本与来源 |
| lib/blog/ | 已确认的内容快照 |
| lib/site-config.json | 域名与链接配置 |
| scripts/ | 生成、检查、发布 |

main 保存源码，gh-pages 保存静态网页。Actions 保持关闭，审阅后手动发布。
正文在独立内容仓库维护；简历主版本在 resume-ng，Drive 只作备份。app/、components/ 保留旧研究站实现。

本地预览需 Node.js 24：

```bash
node scripts/prepare-publish.mjs
node scripts/finalize-homepage.mjs
python3 -m http.server 4173 --directory publish
```

访问 http://localhost:4173。这只预览主页，文章链接仍去研究站。

[设计](docs/ARCHITECTURE.md) · [内容维护](docs/CONTENT-MAINTENANCE.md)

复用资源前查看对应 SOURCES.md 和许可证；引用保留来源，个人资料自行替换。
