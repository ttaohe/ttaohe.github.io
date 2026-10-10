import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DiagramBoard } from "./diagram-board";

// Markdown is opt-in; existing plain-text posts keep their original rendering.
export function safeArticleUrl(value: string, image = false): string {
  if (!value || /[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith("//")) return "";
  if (value.startsWith("#")) return image ? "" : value;
  if (value.startsWith("/")) {
    return !image || /^\/(?:ai-infra-daily-notes\/)?diagrams\//.test(value) ? value : "";
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    if (image && !(
      (url.origin === "https://ttaohe.github.io" && url.pathname.startsWith("/ai-infra-daily-notes/diagrams/")) ||
      (url.origin === "https://ai-infra-daily.ttaohe.chatgpt.site" && url.pathname.startsWith("/diagrams/"))
    )) return "";
    return url.href;
  } catch { return ""; }
}

export function ArticleMarkdown({ text, diagramDownloadUrl }: { text: string; diagramDownloadUrl?: string }) {
  return <div className="article-markdown min-w-0">
    <Markdown remarkPlugins={[remarkGfm]} skipHtml
      urlTransform={(url, key) => safeArticleUrl(url, key === "src")}
      components={{
        h1: ({children}) => <h3 className="mb-4 mt-8 text-xl font-semibold leading-relaxed text-[#214c4b]">{children}</h3>,
        h2: ({children}) => <h3 className="mb-4 mt-8 text-xl font-semibold leading-relaxed text-[#214c4b]">{children}</h3>,
        h3: ({children}) => <h3 className="mb-4 mt-8 text-xl font-semibold leading-relaxed text-[#214c4b]">{children}</h3>,
        h4: ({children}) => <h4 className="mb-3 mt-6 text-lg font-semibold leading-relaxed text-[#293d43]">{children}</h4>,
        p: ({node, children}) => node?.children.some(child => child.type === "element" && child.tagName === "img")
          ? <div className="mb-5">{children}</div> : <p className="mb-5 text-[17px] leading-[1.95] text-[#465d64]">{children}</p>,
        a: ({href, children}) => href ? <a href={href} className="break-words text-teal-700 underline underline-offset-4" rel="noreferrer noopener">{children}</a> : <>{children}</>,
        ul: ({children}) => <ul className="mb-6 list-disc space-y-2 pl-6 text-[17px] leading-[1.95] text-[#465d64]">{children}</ul>,
        ol: ({children, start}) => <ol start={start} className="mb-6 list-decimal space-y-2 pl-6 text-[17px] leading-[1.95] text-[#465d64]">{children}</ol>,
        pre: ({children}) => <pre className="my-6 max-w-full overflow-x-auto rounded-xl bg-[#18343b] p-5 font-mono text-sm leading-7 text-[#d7f1e6]">{children}</pre>,
        code: ({children, className}) => <code className={className}>{children}</code>,
        table: ({children}) => <div className="my-6 max-w-full overflow-x-auto rounded-xl border border-[#d9e7e2]" role="region" aria-label="可横向滚动的数据表" tabIndex={0}><table className="w-full min-w-[620px] border-collapse text-left text-sm leading-7">{children}</table></div>,
        th: ({children}) => <th className="border-b border-[#d9e7e2] bg-[#f6faf8] px-4 py-3 font-semibold text-[#214c4b]">{children}</th>,
        td: ({children}) => <td className="border-b border-slate-100 px-4 py-3 align-top text-[#465d64]">{children}</td>,
        img: ({src, alt}) => src && typeof src === "string" ? <DiagramBoard url={src} caption={alt} downloadUrl={safeArticleUrl(diagramDownloadUrl || "") || undefined}/> : <span>{alt || "图片路径未通过检查"}</span>,
      }}>{text}</Markdown>
  </div>;
}

export function ArticleSourceLabel({text}: {text: string}) {
  return <span className="article-markdown"><Markdown skipHtml allowedElements={["p", "strong", "em", "code", "del", "br"]} unwrapDisallowed
    components={{p: ({children}) => <>{children}</>}}>{text}</Markdown></span>;
}
