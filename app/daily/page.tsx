import {sitePath} from "@/lib/site-path";
import DailyDashboard from "@/components/blog/daily-dashboard";
import {loadBlog} from "@/lib/blog/load";
import fallback from "@/lib/blog/daily-snapshot.json";
import type {DailyData} from "@/lib/blog/types";
export const metadata={title:"AI Infra 日报 · Tao Infra Notes",alternates:{canonical:sitePath("/daily/")}};
export default async function DailyPage(){const {content}=await loadBlog();return <DailyDashboard data={content.daily || fallback as DailyData}/>;}
