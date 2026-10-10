import repair from "./bounded-replay-presentation.json" with {type:"json"};

// A presentation repair for one verified legacy revision. Authority bytes stay untouched.
export function canonicalArticle(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalArticle).join(",") + "]";
  return "{" + Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+canonicalArticle(value[key])).join(",") + "}";
}
export async function presentArticle(post) {
  if (!post || post.slug !== repair.slug || post.bodyFormat === "markdown") return post;
  const bytes = new TextEncoder().encode(canonicalArticle(post));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
  if (hash !== repair.expectedLegacySha256) return post;
  return {...post,...repair.presentation};
}
export async function presentBlogContent(content) {
  let changed = false;
  const posts = await Promise.all(content.posts.map(async post=>{const value=await presentArticle(post);changed ||= value !== post;return value;}));
  return changed ? {...content,posts} : content;
}
