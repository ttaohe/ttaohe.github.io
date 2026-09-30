import {sitePath,SITE_ORIGIN} from "@/lib/site-path";
import type { Metadata } from "next";
import "./globals.css";
import {FeedNotice} from "@/components/blog/feed-notice";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  alternates: { canonical: sitePath("/") },
  title: "Tao · AI Infra 研究笔记",
  description: "Tao 的 AI Infra 技术研究笔记：知识地图、源码分析、机制图解与可验证的设计思考。",
  icons: {
    icon: sitePath("/favicon.svg"),
    shortcut: sitePath("/favicon.svg"),
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased"><FeedNotice/>{children}</body>
    </html>
  );
}
