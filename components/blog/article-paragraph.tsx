import { parseArticleHeading } from "@/lib/blog/article-heading";

export function ArticleParagraph({ slug, text }: { slug: string; text: string }) {
  const heading = parseArticleHeading(slug, text);
  const paragraphClass = "mb-5 text-[17px] leading-[1.95] text-[#465d64]";
  if (!heading) return <p className={paragraphClass}>{text}</p>;

  return <>
    {heading.level === 3
      ? <h3 className="mb-4 mt-8 text-xl font-semibold leading-relaxed text-[#214c4b]">{heading.title}</h3>
      : <h4 className="mb-3 mt-6 text-lg font-semibold leading-relaxed text-[#293d43]">{heading.title}</h4>}
    {heading.body && <p className={paragraphClass}>{heading.body}</p>}
  </>;
}
