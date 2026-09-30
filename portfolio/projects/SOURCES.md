# Project 01: MLA L2 Host Cache Deduplication

Stable public index: `https://ttaohe.github.io/#mla-tp-l2-cache-deduplication`

Stable document URL: `https://ttaohe.github.io/projects/mla-tp-l2-cache-deduplication/`

## Project-specific evidence

The portfolio owner supplied this project summary and explicitly approved public disclosure on 2026-09-30. The mechanism and measurements are the owner's account of their work, not independently reproduced benchmarks. The summary concerns Kimi 2.6 / 2.7 MLA Prefill with tensor parallelism and HiCache L2 host-cache duplication.

Reported mechanism: TP0 owns the real host allocation and canonical radix-tree hit decision; peer ranks use dummy allocation. Hits load from L2 into TP0's L1 before broadcast to the other TP ranks. Detailed allocation and synchronization design will be documented by the owner later.

Reported outcomes in the project's configuration: effective L2 capacity 8×; cache hit rate approximately 94%, versus more than 80% before and approximately 95% theoretical; approximately 40% higher throughput during a one-hour peak window at equal concurrency. The TP degree, hardware, precise workload, throughput unit, hit-rate denominator and experimental protocol were not supplied. Do not infer these, interpret the numbers as universal results, or claim an increase in physical DRAM/GPU cache capacity.

The homepage intentionally has a compact title, keywords, one paragraph with inline emphasis, and a stable anchor, not large metric cards. On 2026-09-30 the owner additionally requested a separate preview document with a pending-content label and hourglass animation. That document has a stable URL, explicitly pending background/design/experiment sections, and reduced-motion support. The complete research record has not been supplied yet.

## Public technical background checked on 2026-09-30

- [SGLang HiCache system design](https://docs.sglang.io/docs/advanced_features/hicache_design): L1 GPU memory, L2 host memory, radix metadata and multi-rank synchronization. This grounds terminology, not the owner's performance numbers.
- [SGLang PR #36800](https://github.com/sgl-project/sglang/pull/36800), head `adee17a1bd88f2d91c23f375cdf1e6e7f1c68697`: allocator-only peer host pools and MLA/DSA broadcast primitives. [Source snapshot](https://github.com/sgl-project/sglang/blob/adee17a1bd88f2d91c23f375cdf1e6e7f1c68697/python/sglang/srt/mem_cache/mla_host_dedup.py). This is background only; no claim is made that the portfolio owner authored or contributed to this PR, or that their implementation is identical.
