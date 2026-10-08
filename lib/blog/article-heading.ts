export type ArticleHeading = {
  level: 3 | 4;
  title: string;
  body: string;
};

// This article's import retained its original subheadings as bracketed prefixes.
// Keep the compatibility rule local to that article, not ordinary prose elsewhere.
export function parseArticleHeading(slug: string, text: string): ArticleHeading | null {
  if (slug !== "pcie-rdma-networking-foundations") return null;
  const match = /^【((?:\d+(?:\.\d+)?\s+)[^】\r\n]+|术语速查)】[ \t]*([\s\S]*)$/.exec(text);
  if (!match) return null;
  return {
    level: /^\d+\.\d+\s/.test(match[1]) ? 4 : 3,
    title: match[1],
    body: match[2],
  };
}
