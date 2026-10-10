import {presentBlogContent} from "./article-presentation.mjs";
import content from "./content.json";
import status from "./feed-status.json";
import { blogSchema } from "./schema";
import type { BlogContent } from "./types";

export async function loadBlog(): Promise<{content:BlogContent;snapshot:boolean}> {
  return {content:blogSchema.parse(await presentBlogContent(content)) as BlogContent, snapshot:status.stale};
}
