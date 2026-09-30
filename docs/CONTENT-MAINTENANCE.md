# Tao Infra Notes：博客内容维护规范

## 阅读与存储

网站首页展示知识地图；`/notes/<slug>` 原生渲染完整文章；原日报保留在 `/daily`；`/research` 是知识地图兼容入口。Google Drive 的 GPTLink 保存笔记、索引、图源与源码备份。公开博客内容文件为 `00-博客内容索引.json`，固定文件 ID `1UxQrRjgTwJzSuYnSLmOJ0MvWoAH4SIvz`，更新时保留此 ID，不另建同名文件。

网站读取该公开文件，缓存最多约五分钟；临时读取失败时显示最后已保存的内容快照，不用每次改文章都重新构建网站。数据发布后，应核验网站正文，而不是只核对文件写入成功。

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

