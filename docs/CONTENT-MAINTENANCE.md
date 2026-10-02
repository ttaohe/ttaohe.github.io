# Tao Infra Notes：博客内容维护规范

## 阅读与存储

网站首页展示知识地图；`/notes/<slug>` 原生渲染完整文章；原日报保留在 `/daily`；`/research` 是知识地图兼容入口。Google Drive 的 GPTLink 保存笔记、索引、图源与源码备份。公开博客内容文件为 `00-博客内容索引.json`，固定文件 ID `1UxQrRjgTwJzSuYnSLmOJ0MvWoAH4SIvz`，更新时保留此 ID，不另建同名文件。

原站读取该公开文件，缓存最多约五分钟；临时读取失败时显示最后已保存的内容快照，不用每次改文章都重新构建原站。GitHub Pages 使用静态构建，内容更新必须重新构建后才会发布。数据发布后，应分别核验两站正文，而不是只核对文件写入成功。

## JSON 格式

顶层字段：schemaVersion 固定为数字 1；updatedAt 为 ISO 日期时间；posts 为完整文章数组。更新单篇时先读取最新文件，保留其他文章，并在写入前重新核对版本；单写者顺序更新。建议总文件小于5MB。

每篇文章字段：
- slug：稳定、唯一，只用小写英文、数字和连字符；发布后不随改标题而变化
- title、subtitle、category、kind、summary、date（YYYY-MM-DD）、tags（字符串数组）
- outline：3–5个开篇问题，与 sections 数量及顺序一致
- sections：每项含 heading（带1、2、3编号）、paragraphs（字符串数组）；可选 bullets（字符串数组）、code（原样代码或公式字符串）
- takeaways、openQuestions、relatedSlugs：字符串数组；relatedSlugs 必须指向已存在文章，不可自链
- sources：数组，每项为 title 和 https URL
- disclosure：说明来源核验时间、AI辅助整理、作者测试与独立复现的边界

已有内置画板可用 sections[].diagram：state-boundary、pd-critical-path、direct-linker；仅在机制相符时复用。新画板将 SVG 与可编辑 draw.io 文件保存在对应公开资料目录，先验证匿名链接可读取，再填写 diagramUrl、diagramDownloadUrl、diagramCaption。SVG 只作为图片渲染，不嵌入脚本或外部私密资源。所有链接必须使用 https。

## 每篇文章的叙述方式

开头先说清1、2、3个问题，随后按照相同次序展开：动机与场景、机制与数据流、证据和实现边界、判断与待验证实验。段落适合网页阅读，不堆砌聊天全文。重要机制用清楚的画板辅助说明；图中注明概念示意、条件路径，不能把箭头长度伪装成性能数据。

正文直接在网站完整阅读，Google Docs 作为可编辑整理稿和备份，不再是阅读全文的唯一去处。维护知识关联与原始来源，保持项目和跨项目主题两种视角。阅读梳理、源码分析、设计设想、实验复现必须如实区分；只有实际运行并保存结果的工作才能称为复现。不要把论文作者的结果写成个人已完成的实验。

## 公开与验证

GPTLink 已设为任何持链接的人可阅读。只放适合公开的技术研究资料，不放凭据、原始私人聊天全文、非公开部署信息或无关个人信息。保留来源和版权边界；允许归档的论文保留版本，博客优先保存原创摘要与链接。

修改内容文件后回读验证：JSON可解析、slug唯一、outline/sections一一对应、relatedSlugs有效、来源URL合法、画板可打开、原有文章未被删除。随后读取网站相应文章的标题、首段与来源，确认实际更新。无实质变化不重复生成文章或伪造更新日期。

## 双站点与统一数据（2026-09-30 修订）

对外作品集路径为 `https://ttaohe.github.io/ai-infra-daily-notes/`；原站 `https://ai-infra-daily.ttaohe.chatgpt.site` 保留。两站以同一固定 Drive JSON 为内容源，GitHub 保留构建所需源码副本，完整源码归档、资料与可编辑图源保存在 GPTLink。GitHub 为静态构建，内容更新须触发构建并核验发布；不能把 Drive 写入成功等同于两站已同步。计划构建是补偿机制，不保证即时更新。

顶层除 posts 外还包含 daily 与 experiments，必须完整保留：
- daily.year：年份；reports：日期键到完整日报条目数组；dates：含 day/week/key 的日期列表；columns：id/name/code/description/color；topicBars：label/value/color；issueMeta：日期键到 headline/subtitle/threadTitle/threadSummary。
- 日报条目字段为 id/rank/category/title/summary/why/source/sourceLabel/reading/signal/columns；signal 仅 high 或 medium。
- experiments：含 id/title/hypothesis/method（字符串数组）/metrics（字符串数组）/falsifier/related（有效文章slug数组）的完整列表。设想和未验证实验不得标为已完成。

更新必须读取最新完整原始 JSON 字节，不以 Drive 文本预览代替；预览为空、读取失败或内容不完整时停止写入。保留未知扩展字段、所有既有文章、日报和实验。上传前再次核对源版本，原ID替换，上传后下载回读校验。随后同步相同已验证快照到 GitHub，确认对应提交构建成功，再核验两站知识地图、相关正文、日报和实验。失败保留上一可用版本，公开状态需如实显示，不能宣布已经同步。

## SVG 图源与网页嵌入验证（2026-09-30 补充）

Google Drive 的 SVG 原始下载链接即使匿名下载成功，也不保证能作为网页 img 嵌入。本次观察到浏览器图片 complete=true 但 naturalWidth=0，因此不能把 HTTP 200 或文件 hash 一致当成可显示证明。

SVG 与可编辑 draw.io 继续在 GPTLink 归档。网页 diagramUrl 应使用经实际浏览器验证可嵌入的 HTTPS 静态图像地址；diagramDownloadUrl 可继续指向已核验的 Drive draw.io 下载。只作图片渲染，不嵌入脚本或私密外部资源。新增图像应在文章内滚动到图像、打开画板／放大界面，检查自然尺寸大于零并查看截图；同时核验桌面与窄屏、两站正文和下载链接。若图源读取失败，应明确呈现不可用状态，不能留下无提示的空白图。

## 本仓库开发与部署

以下说明从 README 移入，适用于 `ttaohe/ttaohe.github.io`。

### 页面与目录

- `/`：代码风格的个人主页，包含已确认的教育经历，以及经历、项目和个人简历占位
- `/ai-infra-daily-notes/`：知识地图与研究笔记
- `/ai-infra-daily-notes/notes/<slug>/`：完整文章
- `/ai-infra-daily-notes/daily/`：当前及历史简报、主题筛选和浏览器本地书签
- `/ai-infra-daily-notes/research/`：知识地图兼容入口
- `/ai-infra-daily-notes/experiments/`：明确标为待验证的实验设想
- `/ai-infra-daily-notes/diagrams/`：静态 SVG 与可编辑 draw.io 图源

早期根路径下的文章、Daily、research 和 experiments 地址保留跳转页，兼容已分享链接。本项目独立于 `ttaoai-homepage`，不使用 `infra-daily` 仓库。

### 本地运行与检查

使用 Node.js 24 和 pnpm 11.19.0。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

提交前检查：

```bash
pnpm test
pnpm lint
pnpm build
```

构建先验证公开 Drive 数据源，再将 Next.js 导出到 `out/`，最后整理为 `publish/`。博客位于 `publish/ai-infra-daily-notes/`；根主页模板是 `portfolio/index.html`。构建会核验配置前缀下的内部路由与资源链接。可用 `python3 -m http.server 4173 --directory publish` 预览完整静态站点。

`lib/site-config.json` 是路径前缀与站点 origin 的唯一配置；`sitePath()` 为应用内链接和资源加前缀，保留外部链接与片段地址。

GitHub Pages 页面与文章使用静态导出，不需要运行时服务器或私有 API key；可选的首页累计访问统计调用独立的聚合接口，见下文。GitHub Actions 使用短期部署凭据，外部 actions 固定到已核验的提交 SHA。

### GitHub Pages 设置与刷新

默认分支为 `main`；Settings → Pages → Source 应选 **GitHub Actions**，工作流只上传 `publish/`。

推送、手动触发和每四小时一次的补偿计划都会启动构建；计划时间为 UTC 每四小时的第 23 分钟。GitHub 定时任务可能延迟，也可能因公开仓库长期无活动而停用，停止刷新时应检查 Actions。

`lib/blog/feed-config.json` 指向统一的公开 Drive JSON。维护时先更新并验证 Drive，再把完全相同的有效内容同步到 `main` 上的 `lib/blog/content.json`，由推送触发构建。定时构建会读取当前数据源，但不会自动提交回仓库。

Drive 保存权威内容、源码归档与原始资料；本仓库保存可部署源码和已验证的回退快照。两站可能在刷新期间短暂显示不同版本，必须核对内容时间戳与线上正文，不能宣称即时同步。

### 读取失败与回退

`scripts/sync-content.mjs` 读取公开原始 JSON，验证文章结构、HTTPS 来源链接、唯一标识、关联文章、日报日期与栏目、响应大小和内容时间戳；若数据源遗漏已提交的文章、日报或实验，会拒绝更新。

获取或验证失败时保留 `lib/blog/content.json`，所有博客页面显示琥珀色的内容可能过期提示。旧版仅含 posts 的数据源仍可读取，缺失的 daily 或 experiments 使用保存的数据，并显示同样提示；完整刷新成功后移除提示。根主页不依赖数据源的实时可用性。

发布时务必同步提交回退快照，否则后续失败会退回旧的已提交版本。`lib/blog/feed-status.json` 记录构建的数据源状态与内容时间戳；`daily-snapshot.json` 和 `experiments.ts` 保留向后兼容的本地默认值，正常页面使用统一内容数据。

### 主页资料与倒计时边界

`portfolio/index.html` 仅展示已确认的教育经历（西北工业大学 / Northwestern Polytechnical University，电子信息工程 / Electronic Information Engineering 本科，2019–2023；武汉大学 / Wuhan University，计算机应用技术 / Computer Application Technology 硕士，2023–2026）和研究方向，并在 Profile 简介下展示已确认的公司 Experience：Xiaomi · On-device Inference Infrastructure、Ant Group · LLM Inference Infrastructure、Infinigence AI · LLM Inference Infrastructure。三项不附当前状态、职位、日期或实习分类；详细经历与项目仍保留待补充占位。公司标识使用官网原始素材，出处与校验值记录于 `portfolio/companies/SOURCES.md`；标识旁已有公司名，所以图片使用空 alt 避免重复朗读。两校校徽使用官网原始素材，出处与校验值记录于 `portfolio/schools/SOURCES.md`，随根主页资源一起进行内容哈希发布。详细项目经历仍为待补充状态；个人 PDF 简历现使用已确认的 ttaohe 第一版，包含教育与工作经历，其余栏目留空。`resume-ng` 仅作为排版模板来源，不使用上游示例经历充当个人信息。个人 PDF 源文件位于 `portfolio/resume/ttaohe-resume.pdf`，通过内容哈希发布，并保留浏览器原生缩放、选字和下载功能。

教育经历使用命名容器查询：教育区域在扣除侧栏与页边距后的实际宽度达到 800px 时呈现两张等宽卡片，否则保持单列。并排时以 CSS subgrid 共享四行内容的自然高度，让两校专业与年份对齐；两校名都只占一行时不预留额外空白，有长校名换行时由实际内容撑高。长文本仍可自然换行。不支持 subgrid 时保留自然高度；不支持容器查询的浏览器安全回退为单列。

最新文章链接和内容更新时间由权威内容快照生成。`lib/update-schedule.ts` 同时供 React 博客和根主页倒计时模块使用。资料检查计划在每四小时 UTC 整点进行，也对应北京时间的每四小时整点；此计划与 GitHub 的第 23 分钟补偿构建不同。

倒计时把固定截止时间保存在会话本地存储中；归零显示“等待更新检查”，只有观察到严格更新的内容时间戳才开启新一轮倒计时。它不代表任务实际执行、完成或保证发布。


### 首页累计访问统计

根主页页脚显示“首页累计访问 X 次”，表示从启用起成功记录的首页加载次数（PV），不是独立访客人数。刷新、重复访问和上线验证可能计入；不追溯启用前的数据，也不以测试数或占位值伪装历史访问量。禁用 JavaScript、网络拦截、接口故障等情况可能导致漏计，公共接口也不提供防刷保证。

`portfolio/visits.mjs` 仅由根主页加载；构建输出为 `/assets/portfolio-visits.js`。每个新 Document 最多发出一次 `POST https://ai-infra-daily.ttaohe.chatgpt.site/api/visits`，正文仅为 `{"page":"home"}`。主题切换、滚动、同页锚点和 BFCache 返回不增加次数。请求不携带凭据或 referrer；模块不创建访客标识、不使用统计 Cookie、本地访客 ID 或浏览器指纹，也不引入第三方统计 SDK。现有主题与倒计时存储独立于此统计。

计数接口由保留的原站提供，应用数据库只保存页面累计值与启用时间，不保存 IP、User-Agent 或个人标识；托管与网络服务商仍可能处理其自身日志或 Cookie，不能据此宣称整条链路完全无日志或 Cookie。CORS 仅允许指定的生产站点。接口与 GitHub Pages 独立发布，静态站源码归档不包含数据库当前值。

写入和读取都设置超时。写入发生不确定的网络错误时，只进行一次 GET 读取，不重试 POST，避免额外计数。明确的 HTTP 错误、无效响应或读取失败显示“首页累计访问暂不可用”，不显示假 0。页面加载次数是轻量参考值，不是审计级流量报表。排查可先只读 GET 同一接口，再检查浏览器是否成功发出跨域 POST；验证产生的真实次数应保留。
