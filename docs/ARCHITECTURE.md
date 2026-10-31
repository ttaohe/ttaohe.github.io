# 网站结构

个人主页介绍作者，研究站承载长文和日报；两者通过链接连接。

| 页面 | 地址 |
| --- | --- |
| 个人主页 | https://www.ttaoai.cn/ |
| 笔记 | https://lab.ttaoai.cn/notes/ |
| 日报 | https://lab.ttaoai.cn/daily/ |

主页沿用代码编辑器布局：简介、教育、经历、研究、简历。项目区留空。主题图标融入顶栏，无外框、无独立底色；支持浅色、深色和护眼主题。

portfolio/ 是当前主页入口。prepare-publish.mjs 生成 publish/，finalize-homepage.mjs 写入 CNAME、处理旧链接并校验结果。资源用内容哈希命名，同时保留稳定别名。

main 保存源码，gh-pages 保存网页。手动发布，Actions 关闭；平台内置 Pages 构建可能仍有记录。app/、components/ 属于保留的旧研究站实现，存在源码不代表仍对外开放。

研究站的项目、实验、管理后台已下线。普通改动不恢复这些栏目。

[内容维护](CONTENT-MAINTENANCE.md) · [发布](MANUAL-PUBLISHING.md)
