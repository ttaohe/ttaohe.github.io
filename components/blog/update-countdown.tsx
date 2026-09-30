"use client";

import { useEffect, useState } from "react";
import { remainingClock, selectReviewDeadline, shanghaiTimestamp, type ReviewDeadline } from "@/lib/update-schedule";

const storageKey = "tao-infra-review-deadline-v1";

export function UpdateCountdown({ updatedAt }: { updatedAt: string }) {
  const [clock, setClock] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let previous: ReviewDeadline | null = null;
    try { previous = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch { /* Storage is optional. */ }
    const now = Date.now();
    const deadline = selectReviewDeadline(now, updatedAt, previous);
    try { sessionStorage.setItem(storageKey, JSON.stringify(deadline)); } catch { /* Storage is optional. */ }
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const value = remainingClock(Date.now(), deadline.target);
      setClock(value);
      if (value === null && interval) clearInterval(interval);
    };
    const start = setTimeout(() => {
      tick();
      if (Date.now() < deadline.target) interval = setInterval(tick, 1000);
    }, 0);
    return () => { clearTimeout(start); if (interval) clearInterval(interval); };
  }, [updatedAt]);

  return <section aria-label="资料更新计划" className="mb-7 rounded-xl border border-[#dce8e2] bg-[#f7faf8] px-5 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-medium text-[#4b6d63]">距离下次资料检查</p>{clock === null ? <p role="status" className="mt-1 text-lg font-semibold text-[#38665a]">等待更新检查</p> : <p aria-live="off" className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-wide text-[#245a50]">{clock ?? "--:--:--"}</p>}</div>
      <div className="text-sm leading-6 text-[#688278]">上次内容更新<br/><time dateTime={updatedAt}>{shanghaiTimestamp(updatedAt)}</time></div>
    </div>
    <p className="mt-3 text-xs leading-6 text-[#71887f]">计划每 4 小时检查，实际发布可能延迟；没有实质新内容时不会更新。</p>
  </section>;
}
