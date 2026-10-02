"use client";
import {sitePath} from "@/lib/site-path";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Layers3,
  Newspaper,
  Radar,
  Sparkles,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { archiveDateLabel, archiveDateFromSearch, archiveDateUrl } from "@/lib/daily-archive";
import { researchForSource } from "@/lib/research-library";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import type { DailyData } from "@/lib/blog/types";

export default function DailyDashboard({data}:{data:DailyData}) {
  const {reports,dates,columns,topicBars,year}=data;
  const archiveDates = useMemo(() => dates.filter((item) => reports[item.key]?.length), [dates, reports]);
  const archiveKeys = useMemo(() => archiveDates.map((item) => item.key), [archiveDates]);
  const [date, setDate] = useState(archiveDates[0]?.key || "");
  const archiveOpener = useRef<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState("today");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState("all");
  const [saved, setSaved] = useState<string[]>([]);
  const [read, setRead] = useState<string[]>([]);

  const latestDate = archiveKeys[0] || "";
  const issue=data.issueMeta?.[date] || {headline:"今日值得关注的 AI Infra 信号",subtitle:`本期 ${reports[date]?.length || 0} 条`,threadTitle:reports[date]?.[0]?.title || "本期线索",threadSummary:reports[date]?.[0]?.why || ""};
  const isColumn = activeColumn !== "all" && tab === "today";
  const isToday = date === latestDate && tab === "today" && !isColumn;
  const selectedColumn = columns.find((item) => item.id === activeColumn);

  useEffect(() => {
    try {
      // Restore device-local preferences only after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved(JSON.parse(localStorage.getItem("infra-daily-saved") || "[]"));
      setRead(JSON.parse(localStorage.getItem("infra-daily-read") || "[]"));
    } catch {
      // Device-local preferences are optional.
    }
  }, []);

  useEffect(() => {
    const restoreDate = () => {
      const selected = archiveDateFromSearch(window.location.search, year, archiveKeys);
      setDate(selected);
      setTab("today");
      setActiveColumn("all");
      setArchiveOpen(false);
      setColumnOpen(false);
      // Normalize invalid dates without adding a misleading history entry.
      const canonical = archiveDateUrl(window.location.href, year, selected, latestDate);
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (canonical !== current) window.history.replaceState(window.history.state, "", canonical);
    };
    // Restore the URL only after hydration; the static export renders the latest issue.
    restoreDate();
    window.addEventListener("popstate", restoreDate);
    return () => window.removeEventListener("popstate", restoreDate);
  }, [archiveKeys, latestDate, year]);

  const allItems = useMemo(
    () => Object.entries(reports).flatMap(([reportDate, list]) => list.map((item) => ({ ...item, reportDate }))),
    [reports],
  );
  const datedReport = (reports[date] || []).map((item) => ({ ...item, reportDate: date }));
  const items = tab === "saved"
    ? allItems.filter((item) => saved.includes(item.id))
    : isColumn
      ? allItems.filter((item) => item.columns.includes(activeColumn))
      : datedReport;
  const viewSubtitle = tab === "saved" ? `跨期收藏 · ${items.length} 条` : isColumn ? `${selectedColumn?.name} · ${items.length} 条` : issue.subtitle;
  const viewEyebrow = tab === "saved" ? "SAVED / 跨期收藏" : isColumn ? `COLUMN / ${selectedColumn?.code}` : `${year} / ${date.replace(".", " / ")}`;

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem("infra-daily-saved", JSON.stringify(next));
  };

  const markRead = (id: string) => {
    const next = read.includes(id) ? read : [...read, id];
    setRead(next);
    localStorage.setItem("infra-daily-read", JSON.stringify(next));
  };

  const openArchive = (opener: HTMLButtonElement) => {
    archiveOpener.current = opener;
    setArchiveOpen(true);
  };

  const selectDate = (key: string) => {
    if (!archiveKeys.includes(key)) return;
    const nextUrl = archiveDateUrl(window.location.href, year, key, latestDate);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.pushState(window.history.state, "", nextUrl);
    setDate(key);
    setTab("today");
    setActiveColumn("all");
    setArchiveOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToday = () => selectDate(latestDate);

  const goSaved = () => {
    setTab("saved");
    setActiveColumn("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectColumn = (columnId: string) => {
    setActiveColumn(columnId);
    setTab("today");
    setColumnOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#eef1f2] text-[#10222b] selection:bg-[#c7ff5e] selection:text-[#10222b]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[238px_minmax(0,1fr)] xl:grid-cols-[238px_minmax(0,1fr)_306px]">
        <aside className="sticky top-0 hidden h-screen border-r border-[#d2dadd] bg-[#10222b] px-5 py-7 text-white lg:flex lg:flex-col">
          <a href="https://ttaohe.github.io/" aria-label="ttaohe · 返回个人主页" className="flex items-center gap-3 rounded px-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c7ff5e]">
            <div className="grid size-10 place-items-center rounded-[14px] bg-[#c7ff5e] text-[#10222b] shadow-[0_0_0_5px_rgba(199,255,94,.08)]">
              <Radar className="size-5" strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-[15px] font-extrabold tracking-tight">ttaohe</p>
              <p className="text-xs text-white/45">DAILY / 09:00</p>
            </div>
          </a>

          <nav aria-label="日报导航" className="mt-12 space-y-2">
            <a href={sitePath("/")} className="flex w-full items-center gap-3 rounded-xl border border-[#c7ff5e]/25 bg-[#c7ff5e]/10 px-3 py-3 text-left text-sm font-semibold text-[#c7ff5e] transition hover:bg-[#c7ff5e]/20"><BookOpen className="size-4" />研究库与实验</a>
            <button onClick={goToday} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${isToday ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
              <Newspaper className="size-4 text-[#c7ff5e]" /> 今日简报
              <span className="ml-auto rounded-full bg-[#c7ff5e] px-2 py-0.5 text-[11px] font-bold text-[#10222b]">{reports[latestDate]?.length || 0}</span>
            </button>
            <button onClick={(event) => openArchive(event.currentTarget)} aria-haspopup="dialog" aria-expanded={archiveOpen} aria-controls="daily-archive-dialog" className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${date !== latestDate && tab === "today" && !isColumn ? "bg-white/10 text-[#c7ff5e]" : "text-white/75 hover:bg-white/5 hover:text-white"}`}>
              <CalendarDays className="size-4" /> 往期归档
              <span className="ml-auto text-xs text-white/45">{archiveDates.length} 期</span>
            </button>
            <button onClick={goSaved} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${tab === "saved" ? "bg-white/10 font-semibold text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
              <Bookmark className="size-4" /> 已收藏
              <span className="ml-auto text-xs text-white/35">{saved.length}</span>
            </button>
          </nav>

          <div className="mt-9 px-2">
            <p className="text-[11px] font-bold tracking-[0.18em] text-white/35">COLUMNS</p>
            <div className="mt-3 space-y-0.5">
              {columns.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectColumn(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition ${isColumn && activeColumn === item.id ? "bg-white/10 font-semibold text-white" : "text-white/52 hover:bg-white/5 hover:text-white"}`}
                >
                  <span className={`size-2 rounded-full ${item.color}`} />
                  <span className="truncate">{item.name}</span>
                  <span className="ml-auto text-[10px] text-white/25">{allItems.filter((article) => article.columns.includes(item.id)).length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 min-h-0 flex-1 overflow-y-auto px-2 pr-1 [scrollbar-width:thin]">
            <p className="text-[11px] font-bold tracking-[0.18em] text-white/35">历史归档</p>
            <div className="mt-4 space-y-1">
              {archiveDates.map((item) => (
                <button
                  key={item.key}
                  onClick={() => selectDate(item.key)}
                  aria-label={`查看 ${archiveDateLabel(year, item.key)} 简报`}
                  aria-current={date === item.key && tab === "today" && !isColumn ? "date" : undefined}
                  className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left transition ${date === item.key && tab === "today" && !isColumn ? "bg-[#c7ff5e] text-[#10222b]" : "text-white/52 hover:bg-white/5 hover:text-white"}`}
                >
                  <span><span className="block text-sm font-bold tabular-nums">{archiveDateLabel(year, item.key)}</span><span className="mt-1 block text-[10px] font-semibold tracking-[0.1em] opacity-65">{item.week} · {reports[item.key]?.length || 0} 条</span></span>
                  {reports[item.key] && <span className="ml-auto size-1.5 rounded-full bg-current opacity-40" />}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#c7ff5e]">
              <BookOpen className="size-3.5" /> 资料库持续整理
            </div>
            <p className="mt-2 text-xs leading-5 text-white/45">资料每 4 小时检查<br />日报目标 09:00 · 北京时间</p>
          </div>
        </aside>

        <main className="min-w-0 px-4 pb-28 pt-5 sm:px-7 sm:pt-8 xl:px-10">
          <header className="mb-7 flex items-center justify-between lg:mb-10">
            <a href="https://ttaohe.github.io/" aria-label="ttaohe · 返回个人主页" className="flex items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 lg:hidden">
              <div className="grid size-9 place-items-center rounded-xl bg-[#10222b] text-[#c7ff5e]">
                <Radar className="size-4" />
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-tight">ttaohe</p>
                <p className="text-[11px] text-[#6c7b81]">每日 09:00</p>
              </div>
            </a>
            <div className="hidden lg:block">
              <p className="text-xs font-bold tracking-[0.16em] text-[#738288]">{viewEyebrow}</p>
              <h1 className="mt-2 text-[clamp(2.1rem,4vw,4.2rem)] font-black leading-[0.95] tracking-[-0.055em] text-[#10222b]">{isColumn ? <>{selectedColumn?.name}<br />专栏</> : tab === "saved" ? <>已收藏<br />AI Infra 信号</> : isToday ? <>{issue.headline}</> : <>往期简报<br />AI Infra 信号</>}</h1>
            </div>
            <div className="rounded-full border border-[#cad3d6] bg-white px-3 py-2 text-xs font-semibold text-[#51636b] shadow-sm">
              内容已发布
            </div>
          </header>

          <section className="mb-6 lg:hidden">
            <p className="text-[11px] font-bold tracking-[0.15em] text-[#738288]">{viewEyebrow}</p>
            <h1 className="mt-2 text-[2.35rem] font-black leading-[0.96] tracking-[-0.055em]">{isColumn ? <>{selectedColumn?.name}<br />专栏</> : tab === "saved" ? <>已收藏<br />AI Infra 信号</> : isToday ? <>{issue.headline}</> : <>往期简报<br />AI Infra 信号</>}</h1>
            {isColumn && <p className="mt-3 text-sm text-[#6d7e85]">{selectedColumn?.description}</p>}
          </section>

          <section aria-label="简报日期导航" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c5d2d6] bg-white p-3 shadow-sm sm:p-4">
            <div className="min-w-0 pl-1">
              <p className="text-[11px] font-semibold text-[#64777f]">{tab === "saved" ? "跨期收藏" : isColumn ? "跨期专栏" : date === latestDate ? "最新一期" : "正在阅读往期"}</p>
              <p className="mt-1 text-base font-extrabold tabular-nums tracking-tight">{tab === "saved" || isColumn ? `共 ${archiveDates.length} 期简报` : archiveDateLabel(year, date)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {date !== latestDate && tab === "today" && !isColumn && <button onClick={goToday} className="rounded-xl px-3 py-3 text-xs font-semibold text-[#1d6c84] hover:bg-[#edf3f3]">回到最新</button>}
              <button onClick={(event) => openArchive(event.currentTarget)} aria-haspopup="dialog" aria-expanded={archiveOpen} aria-controls="daily-archive-dialog" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#10222b] px-4 py-3 text-sm font-bold text-[#c7ff5e] transition hover:bg-[#1c3743] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6c84]">
                <CalendarDays className="size-4" /> 往期归档 <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white">{archiveDates.length} 期</span>
              </button>
            </div>
          </section>

          <div className="mb-6 flex items-center justify-between gap-3">
            <Tabs value={tab} onValueChange={(value) => value === "saved" ? goSaved() : goToday()}>
              <TabsList className="h-10 rounded-full border border-[#d4dcdf] bg-white p-1 shadow-sm">
                <TabsTrigger value="today" className="rounded-full px-4 text-[13px] data-[state=active]:bg-[#10222b] data-[state=active]:text-white">{isColumn ? `${selectedColumn?.name} ${items.length}` : `本期 ${reports[date]?.length || 0} 条`}</TabsTrigger>
                <TabsTrigger value="saved" className="rounded-full px-4 text-[13px] data-[state=active]:bg-[#10222b] data-[state=active]:text-white">已收藏 {saved.length}</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="hidden text-xs text-[#7e8c91] sm:block">{viewSubtitle}</p>
          </div>

          <a href={sitePath("/")} className="mb-6 flex items-center gap-3 rounded-2xl border border-[#cbd8dc] bg-[#e4eceb] px-4 py-4 text-[#10222b] transition hover:bg-[#dbe6e4]">
            <BookOpen className="size-5 shrink-0 text-[#1d6c84]" />
            <span><span className="block text-base font-bold">从日报继续深入研究</span><span className="mt-1 block text-sm text-[#61747c]">专题笔记 · 源码分析 · 想法与实验</span></span>
          </a>

          <section aria-label="日报内容" className="space-y-4">
            {items.length === 0 ? (
              <div className="rounded-[26px] border border-dashed border-[#bcc7ca] bg-white/55 px-6 py-16 text-center">
                <Bookmark className="mx-auto size-7 text-[#90a0a6]" />
                <h2 className="mt-4 text-lg font-bold">{tab === "saved" ? "还没有收藏内容" : isColumn ? "这个专栏还没有内容" : "这一天没有归档"}</h2>
                <p className="mt-1 text-sm text-[#718087]">{tab === "saved" ? "在简报右上角点一下书签，之后会集中显示在这里。" : isColumn ? "新内容会在每日简报更新后自动归入这里。" : "选择有绿色圆点的日期查看已归档简报。"}</p>
              </div>
            ) : (
              items.map((item, index) => {
                const featured = index === 0 && tab !== "saved" && date === latestDate;
                const isSaved = saved.includes(item.id);
                const isRead = read.includes(item.id);
                const research = researchForSource(item.source);
                return (
                  <article
                    key={item.id}
                    className={`group relative overflow-hidden rounded-[26px] border p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(16,34,43,.09)] sm:p-7 ${featured ? "border-[#10222b] bg-[#10222b] text-white" : "border-[#d6dee0] bg-white text-[#10222b]"}`}
                  >
                    {featured && <div className="absolute -right-16 -top-24 size-64 rounded-full border-[44px] border-[#c7ff5e]/10" />}
                    <div className="relative flex gap-4 sm:gap-6">
                      <div className={`hidden h-fit min-w-12 rounded-xl px-2 py-2 text-center font-mono text-sm font-bold sm:block ${featured ? "bg-[#c7ff5e] text-[#10222b]" : "bg-[#edf1f2] text-[#617178]"}`}>{item.rank}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className={`text-[11px] font-extrabold tracking-[0.14em] ${featured ? "text-[#c7ff5e]" : "text-[#527079]"}`}>{item.category}</span>
                              {isColumn && <span className="rounded-full bg-[#edf1f2] px-2 py-1 text-[10px] font-bold text-[#6d7d83]">{item.reportDate}</span>}
                              {item.signal === "high" && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${featured ? "bg-white/10 text-white/70" : "bg-[#fff1e5] text-[#b55a14]"}`}>
                                  <Flame className="size-3" /> HIGH SIGNAL
                                </span>
                              )}
                              {isRead && <span className="inline-flex items-center gap-1 text-[11px] text-[#72c891]"><Check className="size-3" /> 已读</span>}
                            </div>
                            <h2 className="max-w-3xl text-[1.24rem] font-extrabold leading-[1.38] tracking-[-0.02em] sm:text-[1.48rem]">{item.title}</h2>
                          </div>
                          <button
                            aria-label={isSaved ? "取消收藏" : "收藏"}
                            onClick={() => toggleSaved(item.id)}
                            className={`grid size-10 shrink-0 place-items-center rounded-full border transition ${featured ? "border-white/15 hover:bg-white/10" : "border-[#dbe2e4] hover:border-[#9eafb5] hover:bg-[#f4f6f6]"}`}
                          >
                            {isSaved ? <BookmarkCheck className="size-4 text-[#8bc938]" /> : <Bookmark className="size-4" />}
                          </button>
                        </div>

                        <p className={`mt-4 max-w-3xl text-[15px] leading-7 ${featured ? "text-white/72" : "text-[#53666e]"}`}>{item.summary}</p>
                        <div className={`mt-5 rounded-2xl border px-4 py-3.5 ${featured ? "border-white/10 bg-white/[0.05]" : "border-[#e2e7e8] bg-[#f6f8f8]"}`}>
                          <p className={`mb-1 text-[11px] font-extrabold tracking-[0.12em] ${featured ? "text-[#c7ff5e]" : "text-[#718188]"}`}>为什么值得你看</p>
                          <p className={`text-sm leading-6 ${featured ? "text-white/75" : "text-[#40555e]"}`}>{item.why}</p>
                        </div>
                        <div className={`mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs ${featured ? "text-white/45" : "text-[#7a898f]"}`}>
                          <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" /> {item.reading}</span>
                          <a
                            href={item.source}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => markRead(item.id)}
                            className={`inline-flex items-center gap-1.5 font-semibold transition ${featured ? "text-[#c7ff5e] hover:text-white" : "text-[#1d6c84] hover:text-[#10222b]"}`}
                          >
                            {item.sourceLabel}<ArrowUpRight className="size-3.5" />
                          </a>
                          {research && <a href={research.webUrl} className={`inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold ${featured ? "text-[#c7ff5e]" : "text-[#1d6c84]"}`}><BookOpen className="size-3.5" />相关专题笔记</a>}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <footer className="mt-10 border-t border-[#d3dbde] py-7 text-xs leading-5 text-[#7b898f]">
            每日简报聚焦增量变化与工程影响。原始来源优先链接到官方仓库、RFC 与论文。
          </footer>
        </main>

        <aside className="sticky top-0 hidden h-screen overflow-y-auto border-l border-[#d2dadd] bg-[#f7f9f9] px-6 py-8 xl:block">
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">今日信号分布</h2>
              <Layers3 className="size-4 text-[#6f7f85]" />
            </div>
            <div className="mt-5 space-y-4">
              {topicBars.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">{item.label}</span><span className="font-mono text-[#7a898f]">{item.value}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e1e7e8]"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-9 rounded-[22px] bg-[#10222b] p-5 text-white">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-[#c7ff5e]"><Sparkles className="size-3.5" /> 本期研究线索</div>
            <h2 className="mt-3 text-xl font-extrabold leading-tight">{issue.threadTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-white/60">{issue.threadSummary}</p>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between"><h2 className="text-sm font-extrabold">你的关注轴</h2><span className="text-[11px] text-[#7d8a8f]">3 / 3</span></div>
            <div className="mt-3 divide-y divide-[#dfe5e6] rounded-2xl border border-[#d9e0e2] bg-white px-4">
              {["SGLang / vLLM", "KV Cache / Mooncake", "模型架构与推理优化"].map((topic) => (
                <div key={topic} className="flex items-center gap-3 py-3.5 text-sm font-semibold"><span className="size-2 rounded-full bg-[#8bc938]" />{topic}<ChevronRight className="ml-auto size-4 text-[#99a6aa]" /></div>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-[#d9e0e2] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="size-4 text-[#1d6c84]" /> 阅读节奏</div>
            <p className="mt-2 text-2xl font-black tracking-[-0.04em]">日报目标 09:00</p>
            <p className="mt-1 text-xs text-[#7d8a8f]">资料每 4 小时检查 · 重要变化入库</p>
          </section>
        </aside>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[20px] border border-white/10 bg-[#10222b]/95 p-1.5 text-white shadow-[0_18px_45px_rgba(16,34,43,.3)] backdrop-blur lg:hidden">
        <button onClick={goToday} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[10px] ${isToday ? "bg-white/10 text-[#c7ff5e]" : "text-white/45"}`}><Newspaper className="size-4" />今日</button>
        <a href={sitePath("/")} className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[10px] text-[#c7ff5e]"><BookOpen className="size-4" />研究</a>
        <Sheet open={columnOpen} onOpenChange={setColumnOpen}>
          <SheetTrigger asChild>
            <button className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[10px] ${isColumn ? "bg-white/10 text-[#c7ff5e]" : "text-white/45"}`}><BookOpen className="size-4" />专栏</button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[78vh] rounded-t-[30px] border-[#d7dfe1] bg-[#f5f7f7] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 text-[#10222b]">
            <div className="mx-auto mt-1 h-1.5 w-10 rounded-full bg-[#c4ced1]" />
            <SheetHeader className="px-1 pb-2 pt-5">
              <SheetTitle className="text-2xl font-black tracking-[-0.04em]">技术专栏</SheetTitle>
              <SheetDescription>按项目或研究方向查看全部历史内容</SheetDescription>
            </SheetHeader>
            <div className="mt-2 grid min-h-0 flex-1 gap-2 overflow-y-auto">
              {columns.map((item) => {
                const count = allItems.filter((article) => article.columns.includes(item.id)).length;
                const active = isColumn && activeColumn === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => selectColumn(item.id)}
                    className={`flex min-h-[4.5rem] items-center rounded-2xl border px-4 text-left transition active:scale-[0.99] ${active ? "border-[#10222b] bg-[#10222b] text-white" : "border-[#d7dfe1] bg-white text-[#10222b]"}`}
                  >
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-xs font-black text-[#10222b] ${item.color}`}>{item.code}</span>
                    <span className="ml-3 min-w-0">
                      <span className="block truncate text-sm font-extrabold">{item.name}</span>
                      <span className={`mt-0.5 block truncate text-xs ${active ? "text-white/45" : "text-[#7b8a90]"}`}>{item.description}</span>
                    </span>
                    <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-white/10 text-white" : "bg-[#eef2f3] text-[#607178]"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
        <button onClick={goSaved} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[10px] ${tab === "saved" ? "bg-white/10 text-[#c7ff5e]" : "text-white/45"}`}><Bookmark className="size-4" />收藏</button>
        <button onClick={(event) => openArchive(event.currentTarget)} aria-haspopup="dialog" aria-expanded={archiveOpen} aria-controls="daily-archive-dialog" className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[10px] ${tab === "today" && date !== latestDate && !isColumn ? "bg-white/10 text-[#c7ff5e]" : "text-white/65"}`}><CalendarDays className="size-4" />往期归档</button>
      </nav>

      <Sheet open={archiveOpen} onOpenChange={setArchiveOpen}>
        <SheetContent id="daily-archive-dialog" side="bottom" onCloseAutoFocus={(event) => { event.preventDefault(); archiveOpener.current?.focus(); }} className="mx-auto max-h-[82dvh] w-full max-w-2xl rounded-t-[30px] border-[#d7dfe1] bg-[#f5f7f7] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 text-[#10222b] sm:px-6">
          <div className="mx-auto mt-1 h-1.5 w-10 rounded-full bg-[#c4ced1]" />
          <SheetHeader className="px-1 pb-2 pt-5">
            <SheetTitle className="text-2xl font-black tracking-[-0.04em]">往期归档</SheetTitle>
            <SheetDescription>共 {archiveDates.length} 期 · 按日期查看完整简报，链接可保存与分享</SheetDescription>
          </SheetHeader>
          <div className="mt-2 grid min-h-0 flex-1 gap-2 overflow-y-auto overscroll-contain px-1 pb-1">
            {archiveDates.map((item) => {
              const count = reports[item.key]?.length || 0;
              const active = date === item.key && tab === "today" && !isColumn;
              return (
                <button key={item.key} onClick={() => selectDate(item.key)} aria-label={`查看 ${archiveDateLabel(year, item.key)} 简报`} aria-current={active ? "date" : undefined} className={`flex min-h-20 shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d6c84] ${active ? "border-[#10222b] bg-[#10222b] text-white" : "border-[#d7dfe1] bg-white text-[#10222b] hover:bg-[#edf3f3]"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><span className="text-base font-extrabold tabular-nums">{archiveDateLabel(year, item.key)}</span><span className={`text-[10px] font-bold ${active ? "text-[#c7ff5e]" : "text-[#61767e]"}`}>{item.key === latestDate ? "最新一期" : item.week}{active ? " · 当前" : ""}</span></span>
                    <span className={`mt-1.5 block truncate text-xs ${active ? "text-white/65" : "text-[#657880]"}`}>{data.issueMeta?.[item.key]?.headline || reports[item.key]?.[0]?.title || "每日 AI Infra 简报"}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-[#c7ff5e] text-[#10222b]" : "bg-[#eef2f3] text-[#607178]"}`}>{count} 条</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
