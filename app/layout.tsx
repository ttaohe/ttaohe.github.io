import type { Metadata } from "next";
import "./globals.css";
import {FeedNotice} from "@/components/blog/feed-notice";

export const metadata: Metadata = {
  title: "Tao · AI Infra 研究笔记",
  description: "Tao 的 AI Infra 技术研究笔记：知识地图、源码分析、机制图解与可验证的设计思考。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased"><FeedNotice/>{children}</body>
    </html>
  );
}
