export const researchLibrary = {
  index: "https://docs.google.com/document/d/1Z8OMQBt3iMLZNrFpdmF8-l7X2MGkUGPEn-ZH6h9k0Oc",
  ideas: "https://docs.google.com/document/d/15IC3J-A4PdMcv87uyTevCB7FIZWoVzFT6ErRHNK7Mno",
  folder: "https://drive.google.com/drive/folders/1-PvGX9u44DFuNhrJKETFzN02ZXveOW0f",
};

export const researchNotes = [
  {
    id: "state-recovery",
    webUrl: "/notes/state-recovery",
    number: "01",
    title: "KV Cache：层级与异构状态恢复",
    description: "从缓存位置到合法恢复边界：梳理 SWA、KDA、Marconi 与 direct linker，保留提前 prefetch 的关键约束。",
    question: "命中的对象齐了，是否就能正确恢复？提前预取之后，Direct 还省下哪段等待？",
    tags: ["KV Cache", "混合注意力", "SGLang / vLLM"],
    date: "2026-09-30",
    stage: "阅读梳理 · 源码分析",
    evidence: "核对论文、PR 与固定版本代码；实验设想尚未验证",
    url: "https://docs.google.com/document/d/1QflRuwoNJGMtZVUohWVKC50995zPdSsRl37XnDupfrg",
    sources: ["/pull/37381", "/pull/41343", "/pull/37898", "2411.19379", "2506.02634", "2407.00023", "DeepSeek-V4.1-Flash"],
  },
  {
    id: "transfer-compute",
    webUrl: "/notes/pd-c2c-coordination",
    number: "02",
    title: "PD 与 C2C：传输、容量和计算协同",
    description: "把提前传输、Decode 准入、DeepEP 争用与 host 直读放到同一条请求关键路径中比较。",
    question: "局部传输变快，为什么未必让 TTFT 或 goodput 变好？",
    tags: ["PD / EP", "C2C / DirectKV", "TENT / MFS / BOOST"],
    date: "2026-09-30",
    stage: "阅读梳理 · 设计设想",
    evidence: "区分下游原型与上游实现；列出对照组、指标与反证条件",
    url: "https://docs.google.com/document/d/1O3RnlKu7CKTiNVcXWYBWtggWxuEJ4-xniOcreDiEgY0",
    sources: ["/pull/39992", "/pull/40238", "2604.00368", "2603.17456", "2609.13592", "shutianluo/DirectKV"],
  },
];

export function researchForSource(source: string) {
  return researchNotes.find((note) => note.sources.some((part) => source.includes(part)));
}
