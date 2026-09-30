import status from "@/lib/blog/feed-status.json";

export function FeedNotice(){
  if(!status.stale) return null;
  return <aside role="status" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm leading-6 text-amber-900">内容源暂时无法更新，当前显示已保存快照（{status.contentUpdatedAt.slice(0,10)}），可能不是最新内容。下次成功构建后会自动恢复。</aside>;
}
