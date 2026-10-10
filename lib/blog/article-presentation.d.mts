export function canonicalArticle(value: unknown): string;
export function presentArticle<T>(post:T):Promise<T>;
export function presentBlogContent<T extends {posts:unknown[]}>(content:T):Promise<T>;
