import { loadBlog } from "@/lib/blog/load";
import { BlogHome } from "@/components/blog/home";
export default async function Home(){ const {content,snapshot}=await loadBlog(); return <BlogHome posts={content.posts} updatedAt={content.updatedAt} snapshot={snapshot}/>; }
