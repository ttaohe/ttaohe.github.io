
# 从文件读写到分布式存储与 3FS

面向大模型推理与机房实践的系统入门教程

把一个文件写进挂载目录，然后再读出来，只需要几行代码。但这几行代码后面，可能包含虚拟内存、文件缓存、设备队列、网络传输、副本协议和故障恢复。要让分布式存储稳定地服务大模型推理，需要知道这些环节各自承诺什么，以及它们如何衔接。

本文从字节、文件和内存开始，逐步建立读写路径、正确性和性能的分析方法，最后用开源 3FS 与 KV 缓存把这些知识串起来。阅读不要求操作系统或分布式系统背景；实验需要能运行 Python，部分 Linux 实验使用 fio 和常见系统工具。

文中的性能数字若未明确引用实测来源，都是用于计算的假设。基础 I/O 语义以 Linux 普通文件为起点；网络文件系统、特殊设备和不同客户端接口需要按各自文档确认。3FS 部分依据其公开仓库与文档，资料核对日期为 2026 年 10 月 31 日。落地时应记录实际使用的 commit、内核、驱动和配置。

## 阅读路线

| 部分 | 章节 | 要建立的能力 |
| --- | --- | --- |
| 单机基础 | 01 至 08 | 解释一次读写的地址、缓存、完成与回收 |
| 硬件与机房 | 09 至 11 | 计算网络、内存、SSD 与拓扑约束 |
| 分布式原理 | 12 至 17 | 解释定位、复制、一致性、失败与恢复 |
| 系统实践 | 18 至 22 | 理解缓存、3FS、KV 存储与容量规划 |
| 实验与自测 | 23 至 26 | 运行最小实验，验证自己的理解 |

第一遍先读概念和算例，第二遍做实验，第三遍再沿着请求路径看源码。对每个新机制，都尝试回答四个问题：数据在哪里，谁可以访问，何时完成，何时可以回收。

## 01 字节 地址和数据布局

### 1.1 文件和张量最终都需要字节表示

一个字节是 8 个二进制位。字节本身没有“图片”“整数”或“KV”含义，解释规则来自程序。例如两个字节可以表示一个 16 位整数，也可以是浮点数编码的一部分。

将张量写成文件，至少要约定数据类型、形状、排列顺序和版本。假设一段数据的形状为 `[2, 4]`，每个元素 2 字节，数据部分就是 16 字节。但只有这 16 字节，另一程序仍然不知道应该怎样解释它。

一种教学用文件布局是：

```text
文件头：格式版本、数据类型、维度、数据长度、校验信息
数据区：按约定顺序排列的张量字节
```

以后看到“零拷贝”，要继续问：哪两个位置之间省了一次拷贝，数据布局是否相容。把指针交给另一个组件，不能自动完成类型和布局转换。

### 1.2 地址属于具体的地址空间

进程通常使用虚拟地址。操作系统与硬件把虚拟地址映射到物理内存。不同进程里数值相同的地址，可能对应不同数据；两个不同虚拟地址，也可能映射同一片共享内存。

```text
进程 A 的地址 0x1000 ──→ 物理内存区域 X
进程 B 的地址 0x1000 ──→ 物理内存区域 Y
进程 A 的共享映射 ────→ 物理内存区域 Z
进程 B 的共享映射 ────→ 物理内存区域 Z
```

因此，不能把一个普通进程指针直接当作跨进程或跨机器的访问凭证。共享内存、RDMA 和 GPU 内存访问都需要额外的映射、注册或授权机制。

### 1.3 逻辑连续与物理连续分别是什么意思

程序看到一个连续数组，不代表它占用连续的物理内存页。文件偏移连续，也不代表文件占用连续的设备块。分布式文件的连续区间，还可能分布在不同存储节点。

这些映射允许系统灵活分配资源，代价是要维护索引，并在访问时完成转换。

### 1.4 把单位写清楚

| 单位 | 含义 |
| --- | --- |
| B | 字节 |
| bit 或 b | 二进制位 |
| KiB MiB GiB TiB | 分别以 1024 为进位单位 |
| kB MB GB TB | 分别以 1000 为进位单位 |
| Gbit/s | 每秒十亿位，常用于网卡 |
| GB/s 与 GiB/s | 两种不同的每秒字节数 |

例如，200 Gbit/s 换算为 25 GB/s，约 23.28 GiB/s。这只是原始速率换算，应用有效吞吐还会受协议、链路和实现开销影响。

**自测：一个 1 GiB 文件，通过有效吞吐 5 GiB/s 的路径读取，单纯传输至少需要多久？答案是 0.2 秒，尚未加入排队和其他操作。**

## 02 进程怎样访问文件

### 2.1 从应用函数到系统调用

Python 的 `open()`、C 的 `fopen()` 和 Linux 的 `open(2)` 位于不同层。语言运行时可能维护自己的缓冲区，再调用操作系统接口。分析路径时，先说明自己讨论哪一层。

```text
应用代码
   ↓
语言运行时或库
   ↓ 系统调用
Linux 内核
   ↓
文件系统与设备或网络
```

系统调用让应用请求内核代为执行受保护的操作。它带来用户态与内核态的切换，但不必然意味着调度器把 CPU 切给另一个进程。分析开销时要区分模式切换和进程上下文切换。

### 2.2 路径 inode fd 和 offset

路径用于查找文件。以常见 Unix 文件系统模型为例，目录把名字关联到 inode；inode 记录文件类型、权限、大小及数据映射等信息。文件名通常属于目录项，并不直接保存在文件 inode 中。

成功打开文件后，进程获得文件描述符 fd。fd 引用内核的打开文件状态，其中可以包含访问标志和当前偏移。另一次独立 `open()` 通常建立独立的打开状态；`dup()` 则会共享原来的打开文件描述。

| 概念 | 主要用途 |
| --- | --- |
| 路径 | 找到命名空间中的对象 |
| inode 身份 | 标识具体文件对象 |
| fd | 当前进程操作已打开对象的句柄 |
| offset | 指定对象内部的位置 |
| 数据映射 | 把文件位置转换成存储位置 |

`open()` 不会因此把整个文件装入内存。[Linux open 说明](https://man7.org/linux/man-pages/man2/open.2.html)

### 2.3 read 和 pread 的区别

`read(fd, buf, n)` 从当前偏移读取，成功后推进偏移。`pread(fd, buf, n, offset)` 显式指定位置，不改变 fd 的当前偏移。多个任务访问同一个文件时，显式偏移更容易避免“我读的时候另一个任务刚改了当前位置”的混乱。

文件读取可能返回少于申请长度的字节。例如接近文件末尾时，申请 4096 字节也可能只得到 100 字节。需要完整读取某段数据时，程序必须累计返回值、推进位置并处理提前结束。[Linux read 说明](https://man7.org/linux/man-pages/man2/read.2.html)

写入也可能只完成部分字节。底层 I/O 封装需要处理短写、错误和必要的重试，而不应只判断返回值是否非负。[Linux write 说明](https://man7.org/linux/man-pages/man2/write.2.html)

### 2.4 改名和删除为什么不一定影响已打开的 fd

打开后的 fd 引用文件对象。把路径改名，不等于改变 fd 指向的对象。删除最后一个目录名字后，只要仍有打开引用，文件对象还可能继续存在，直到引用释放。

这与缓存生命周期有关：名字不可见、请求结束、引用消失、物理空间回收，可能发生在不同时间。后面讨论分布式垃圾回收时，还会再次遇到这一点。

## 03 文件系统如何组织数据

### 3.1 从文件偏移到设备地址

假设一个 12 KiB 文件按 4 KiB 划成三个逻辑块：

```text
文件逻辑块： 0    1    2
设备逻辑块： 100  800  203
```

程序顺序读取文件时，文件系统查询映射并组织 I/O。连续范围也可以用 extent 表示，例如“从文件第 20 块开始的 100 块，对应设备某个连续范围”，以减少映射记录。

设备逻辑地址仍不是 SSD 内部闪存的最终位置，SSD 控制器还要维护下一层映射。

### 3.2 元数据为什么会成为单独的负载

打开、创建、重命名、查询属性都涉及元数据。读取一个大文件，可能只做少量元数据操作，再连续搬运大量内容；读取一百万个小文件，可能反复查目录、权限和布局。

因此，两个任务即使读取总字节数相同，对存储系统的压力也可能完全不同。

```text
一个 1 GiB 文件：少量命名操作 + 大量数据
很多小文件：大量命名操作 + 分散的小量数据
```

文件系统基本结构可以通过 [OSTEP 文件系统实现章节](https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf)进一步学习。

### 3.3 三种容易混淆的大小

| 大小 | 所属层次 |
| --- | --- |
| 内存页大小 | 操作系统管理和映射内存的单位之一 |
| 文件系统块大小 | 文件系统分配或组织存储空间的单位之一 |
| 分布式 chunk 大小 | 分布式存储放置和传输数据的逻辑单位 |

KV cache 页大小属于推理框架。它可以与上述单位不同。应用一次 128 KiB 读取，也不意味着所有层都会执行一个 128 KiB 请求；请求可能被拆分，也可能被合并。

### 3.4 稀疏文件和预分配

把文件长度设置为 128 GiB，并不一定实际写入了 128 GiB 数据。稀疏文件的空洞读取通常得到零，底层不需要为每个字节读取介质。预分配也不能等同于写入了代表真实负载的数据。

做读性能实验前，要说明文件如何生成，是否实际写满，数据是否会被压缩或去重。否则测到的可能不是预计的数据路径。

## 04 缓冲 I/O 和文件缓存

### 4.1 Page Cache 在哪里

对典型 Linux 本地文件的缓冲 I/O，内核使用 CPU 内存缓存文件内容。读取大致经过：

```text
应用申请读取
   ↓
查询 Page Cache
   ├─ 命中 → 复制给应用
   └─ 未命中 → 提交存储读取 → 填入缓存 → 复制给应用
```

缓存命中可以避免较慢的设备访问，但仍然消耗 CPU、内存带宽和映射管理资源。命中缓存不等于没有成本。

### 4.2 写入为什么能使后续读取变热

缓冲写入通常先把数据复制到 Page Cache，标记为脏页，再由系统写回。刚写完立即读，目标数据可能已经在内存里，即使这是程序第一次调用读取。

“冷读”必须指明是哪一层没有数据：应用自己的缓存、文件系统缓存、远端缓存或设备缓存。程序重启和文件关闭，都不能证明所有层已经变冷。

### 4.3 写回 预读和缓存淘汰

写回把脏数据传向持久存储；预读根据访问规律提前读取后续范围；淘汰为其他数据腾出缓存空间。这些机制会改变请求在各层的大小与时序。

例如应用读取前 1 MiB，文件系统可能额外预读后续内容。因此“网卡收到的字节”和“应用已经消费的字节”不必时时相等。

### 4.4 mmap 改变了访问方式

`mmap()` 把文件范围映射进进程虚拟地址空间。程序通过内存访问触发取页，而不必为每段数据都显式调用 `read()`。映射成功不表示所有内容已驻留内存，首次访问仍可能触发缺页和 I/O。

对普通文件映射，`mmap` 通常仍与文件缓存协作。`MAP_SHARED` 修改可以反映到文件；`MAP_PRIVATE` 的写入采用私有的写时复制语义。控制映射修改的同步还需要相应机制，不能把 `munmap()` 当成持久化承诺。[Linux mmap 说明](https://man7.org/linux/man-pages/man2/mmap.2.html)

### 4.5 特殊文件系统需要自己的缓存模型

原生 GPFS 客户端使用自己的 pagepool 管理文件数据与元数据。它不应机械地套用普通本地文件 Page Cache 的模型。pagepool 大小也不等于机器全部可用内存；动态配置还需要看当前实际大小。[IBM pagepool 说明](https://www.ibm.com/docs/en/storage-scale/6.0.1?topic=configuring-parameters-performance-tuning-optimization)

## 05 直接 I/O 持久化和原子更新

### 5.1 把缓存路径和持久化分开

`O_DIRECT` 主要改变文件数据的缓存路径，支持时通常绕过普通文件 Page Cache。它不绕过所有内核代码，也不自动绕过远端服务、阵列控制器或 SSD 内部缓存。地址、偏移和长度的对齐要求取决于文件系统和设备。

```text
缓冲路径：应用内存 → Page Cache → 设备缓存 → 稳定存储
直接路径：应用内存 ─────────→ 设备缓存 → 稳定存储
```

设备可能在数据进入易失性写缓存时就报告完成。因此，Direct I/O 完成和掉电后仍可恢复，是两个不同的状态。[Linux 设备写缓存说明](https://docs.kernel.org/block/writeback_cache_control.html)

### 5.2 fsync 和 fdatasync

`fsync(fd)` 要求把文件修改同步到存储，包括相关文件元数据，并等待设备报告完成。`fdatasync(fd)` 可以省去不影响后续正确读取的部分元数据同步，例如某些时间戳更新。

同步可能涉及设备 flush 或 FUA。其目的是满足稳定存储语义，不一定要求每次都立刻把数据写入 NAND；具有合适掉电保护的存储也可能满足相应承诺。[Linux fsync 说明](https://man7.org/linux/man-pages/man2/fsync.2.html)

| 机制 | 缓存路径 | 对此前修改的同步要求 |
| --- | --- | --- |
| 普通 write | 通常经过文件缓存 | 单独返回不保证持久化 |
| O_DIRECT write 完成 | 通常绕过文件数据缓存 | 单独使用不提供 O_SYNC 的保证 |
| write 后 fsync 成功 | 可使用缓冲或直接路径 | 同步文件数据与相关元数据 |
| O_SYNC | 可以与 O_DIRECT 组合 | 每次写入返回前满足文件同步要求 |

对异步 I/O，要先正确协调相关写入完成，再建立所需同步顺序。不能在请求还没真正提交或完成时，随意插一个同步调用就认为依赖已经成立。[Linux open 说明](https://man7.org/linux/man-pages/man2/open.2.html)

### 5.3 原子性和持久性也要分开

原子性关心别人是否能看到一半更新；持久性关心已经承诺的更新在故障后是否保留。一次任意大小的文件写入，不应默认具备整体原子性。`fsync` 也不是多文件事务。

一个常用的单文件发布模式是：在目标同目录创建唯一临时文件，完整写入，同步临时文件，原子替换目标名字，再同步父目录。重命名提供命名空间切换，文件与目录同步处理不同持久化部分。[Linux rename 说明](https://man7.org/linux/man-pages/man2/rename.2.html)

这依赖目标文件系统对相关操作的实际语义。跨文件系统移动不能直接套用同样的原子替换假设。

### 5.4 日志怎样帮助崩溃恢复

更新一个文件可能同时涉及数据、空间分配和 inode。系统可能在这些步骤中途崩溃。日志或写时复制等机制，帮助恢复到有定义的状态。

教学用的日志思路是：先记录足以恢复的意图或内容，再记录提交状态，恢复时只按有效提交规则处理。真正实现还要考虑写入顺序、校验和、记录截断以及重复恢复。文件系统日志的存在，也不意味着应用所有数据已经持久化。[OSTEP 崩溃一致性章节](https://pages.cs.wisc.edu/~remzi/OSTEP/file-journaling.pdf)

## 06 同步 异步与内存所有权

### 6.1 四个维度分别描述什么

| 维度 | 主要问题 |
| --- | --- |
| 同步与异步 | 调用如何报告操作完成 |
| 阻塞与非阻塞 | 当前调用是否等待某个条件 |
| 缓冲与直接 | 数据走哪条缓存路径 |
| 持久化要求 | 哪个时刻可以承诺故障后仍可恢复 |

这些词在不同 API 中有具体定义，不能仅凭名称推断。例如异步直接写入是合理组合：先提交，之后收取完成通知，数据绕过文件缓存；需要时再建立持久化保证。

### 6.2 异步的收益来自重叠

假设每个请求有 1 ms 等待时间，程序提交一个就等待一个，会浪费很多可并行资源。提前提交多个请求，可以让设备或网络同时处理。

```text
串行：提交 A → 等 A → 提交 B → 等 B
异步：提交 A → 提交 B → 提交 C → 收集各自完成
```

异步不会使单个设备变快。它允许在等待时处理其他工作，并让系统拥有足够在途请求。并发过多也会增加排队和尾延迟。

### 6.3 提交之后 谁还在访问 buffer

异步写入可能在调用返回后继续读取源 buffer。异步读取可能在返回后继续修改目标 buffer。因此，直到完成条件满足前，调用方需要按 API 约定保留内存及其内容。

```text
FREE → RESERVED → IN_FLIGHT → READY 或 ERROR → 可回收
```

更准确地说，回收需要满足所有使用者的条件：请求不再读取、设备不再写入、远端传输不再访问、共享引用已经解除。

只统计“有几个业务请求使用它”的引用计数，可能漏掉 GPU kernel、磁盘 I/O 或 RDMA 传输。引用管理必须覆盖全部生命周期。

### 6.4 取消业务请求不等于取消硬件操作

客户端断开后，业务可以停止等待结果，但已经提交的设备操作可能仍会完成。错误路径必须明确：停止提交后续请求、等待已提交操作排空、处理完成通知，然后再回收内存。

给页面增加代次号，可以帮助检测旧句柄。但如果网卡已经持有可写地址，单纯改变软件代次号并不能阻止迟到 DMA 写入。检测、访问隔离与安全回收需要协作。

### 6.5 io_uring 的基本结构

io_uring 使用提交队列 SQ 和完成队列 CQ。应用准备请求并提交，内核执行后发布完成信息。共享队列可以减少请求描述信息的交换开销，但不表示文件数据自动零拷贝，也不自动提供持久化。

```text
应用 → 提交队列 SQ → 内核执行
应用 ← 完成队列 CQ ← 执行结果
```

需要分别管理请求描述、数据 buffer 和完成记录的生命周期。[Linux io_uring 说明](https://man7.org/linux/man-pages/man2/io_uring_setup.2.html)

## 07 延迟 带宽 IOPS和队列

### 7.1 三个指标描述不同方面

延迟是一次操作从选定起点到终点的时间。IOPS 是每秒完成的 I/O 数。带宽是每秒传输字节数。对固定请求大小，有：

```text
带宽 = IOPS × 每次 I/O 字节数
```

100000 次每秒的 4 KiB 请求，约为 390.625 MiB/s；同样 IOPS 如果每次 1 MiB，就要求约 97.66 GiB/s。比较 IOPS 时必须同时说明请求大小。

### 7.2 队列深度为什么重要

稳态下，Little 定律把平均在途请求数、完成率和平均延迟关联起来：

```text
平均在途数 = 每秒完成请求数 × 平均延迟
所需在途字节数 ≈ 目标带宽 × 平均端到端延迟
```

假设目标是 10 GiB/s，每次 1 MiB，平均端到端延迟 2 ms，则需要约 20.48 个实际在途请求。这个估算不是让你把配置固定为 21：负载分布、批处理、设备并行度和尾延迟都影响实际选择。

增加队列深度后，如果吞吐不再增长而延迟上升，说明请求主要在排队。瓶颈可能是设备、网络或软件处理，不能仅凭这条曲线确定位置。

### 7.3 平均值和尾延迟

平均值低，不能保证少数请求不慢。P99 表示约 99% 的样本不超过这个值；它不表示系统有 99% 可用性。百分位的采样方法、样本数量和时间窗口都应记录。

当一个业务请求需要多个并行子请求全部完成时，最慢的子请求会影响总体完成时间。分散读取提升吞吐，也可能扩大尾部暴露，需要在设计中考虑。

### 7.4 吞吐模型要包含放大系数

教学用上界可以写成：

```text
逻辑吞吐上界 ≤ min(各段资源有效能力 ÷ 对应数据放大系数)
```

三副本写入会增加设备写入量和网络流量；额外内存拷贝会增加 DRAM 流量。因此不能把 SSD 总带宽直接当作应用可用带宽。

## 08 SSD和NVMe基础

### 8.1 NVMe和NAND属于不同层

NVMe 是访问非易失存储的协议体系，NAND 是常见存储介质。SSD 还包括控制器、固件、地址映射和缓存。应用看到的逻辑地址通过 FTL 映射到闪存位置。

闪存通常需要按较大单位擦除，不能像内存那样任意原地覆盖。SSD 常通过写到新位置、更新映射，再回收旧位置来处理修改。

### 8.2 垃圾回收与写放大

为了回收擦除块，设备可能搬运其中仍然有效的数据。若应用写入 1 GiB，而设备内部实际写入 1.5 GiB，可把这一范围内的介质写放大记为 1.5。

分布式复制、文件系统日志和设备内部 GC 是不同层的放大。估算耐久度时，需要避免漏算或重复计算。

### 8.3 为什么短测试不代表持续表现

设备刚开始写入时可能有充足空闲空间和快速缓存，持续运行后进入另一种状态。剩余容量、温度、GC、读写混合与后台任务都会改变性能。

比较 SSD 性能时，要说明设备状态、访问模式、持续时间、读写比例和是否进入稳定阶段。不能把某个型号宣传的峰值当作当前工作负载的保证。[OSTEP SSD 章节](https://pages.cs.wisc.edu/~remzi/OSTEP/file-ssd.pdf)

## 09 网络 RPC与RDMA

### 9.1 一次远端请求包含什么

应用发送读取请求，服务端接收并检查参数，定位数据，必要时等待存储设备，再把结果送回。网络往返时间只是其中一部分。

```text
客户端排队
→ 发送请求
→ 网络传输
→ 服务端排队与处理
→ 存储访问
→ 返回数据
→ 客户端处理完成
```

RPC 是远程过程调用：把调用转换为消息、传输、处理和响应。实现需要定义请求身份、序列化、超时、错误和重试语义。远程调用看起来像函数，不代表拥有本地函数的失败模式。

### 9.2 TCP与RDMA怎样理解

TCP 为应用提供可靠、有序的字节流。RDMA 允许网卡依据已建立的连接与内存权限，把数据送入或取自注册内存，减少某些数据路径上的 CPU 参与和拷贝。

RDMA 不等于没有 CPU、没有协议或没有排队。CPU 仍需要建立连接、注册资源、提交工作、处理完成和维护应用状态。

InfiniBand 与 RoCE 是常见的 RDMA 网络选择。RoCE 的性能与拥塞控制、交换机缓冲、ECN/PFC 等配置有关；它们的具体策略应依据硬件和网络设计验证，不应照搬其他机房的一组开关。

### 9.3 认识几个RDMA对象

| 对象 | 初学时需要理解的含义 |
| --- | --- |
| MR | 注册的内存区域，描述地址范围与访问权限 |
| lkey rkey | 本地与远端访问时使用的权限相关标识 |
| QP | 提交发送、接收等工作的队列对 |
| WR | 要交给网卡执行的工作请求 |
| CQ CQE | 完成队列及其中的完成记录 |
| PD | 把相关 RDMA 资源组织到保护域 |

注册内存具有成本，常需要与页固定、映射和权限管理协作。因此高吞吐系统经常复用注册池，而不是每个小请求都从头注册。具体平台也可能支持按需分页等机制。[NVIDIA RDMA 编程指南](https://networking-docs.nvidia.com/doca/archive/3-5-0/rdma-aware-networks-programming-guide)

### 9.4 传输完成不等于远端业务提交

网卡完成了某项数据传输，不代表远端应用已经校验数据、更新索引或写入稳定存储。具体完成事件的作用范围由操作类型和 API 定义。

例如发送方知道“传输已完成”，接收方还可能需要验证请求身份、长度和版本，再发布“对象可读”。协议必须把这些状态连接起来。

同样，RPC 超时只表示调用方没有及时得到结果，不能证明服务端没有执行。稍后讨论幂等重试时，这一点非常重要。

## 10 CPU NUMA和PCIe拓扑

### 10.1 机器内存不一定等距离

多 socket 或某些多节点 NUMA 系统中，不同 CPU 核心访问某片内存的代价可能不同。网卡和 NVMe 也通过特定 PCIe 根连接到系统。

```text
CPU及NUMA节点 0 ── 本地内存 0 ── NIC 0
        │ socket间互连
CPU及NUMA节点 1 ── 本地内存 1 ── NVMe组 1
```

如果工作线程在节点 0，buffer 分配在节点 1，网卡又靠近节点 0，数据可能额外跨越 socket。绑线程时不考虑内存放置，仍然可能产生远端内存流量。Linux 内存策略决定从哪些 NUMA 节点分配内存。[Linux NUMA 说明](https://docs.kernel.org/mm/numa.html)

### 10.2 多设备可能共享同一段带宽

一台机器的多块 SSD 可以共享 PCIe switch 或上行链路。把每块 SSD 的单独峰值相加，可能超过共同上行能力。双网卡也可能在 CPU、内存或 PCIe 根上发生竞争。

因此，需要把硬件清单转换为连接图。只有“16 块 SSD、两张网卡”还不够，至少要知道各自连接的位置与共享链路。

### 10.3 内存拷贝的带宽账

一次 CPU 内存拷贝，概念上包含读取源和写入目标。若逻辑吞吐为 20 GiB/s，一次额外拷贝就可能带来约 40 GiB/s 的读写流量；实际 DRAM 事务还受缓存、写分配和实现影响。

如果一份数据在应用、客户端、网络 buffer 间被复制多次，DRAM 和 CPU 可能先于网络耗尽。这就是为什么需要追踪每份数据的来源和目的地。

### 10.4 收集拓扑信息

Linux 上可用以下只读命令建立第一份资源图，具体工具是否安装取决于环境：

```bash
lscpu
numactl --hardware
lspci -tv
lsblk -o NAME,TYPE,SIZE,MODEL,MOUNTPOINTS
```

再把网卡与设备的 NUMA 节点、实际协商链路宽度及速度补进表中。系统报告的“未知 NUMA 节点”不应被解释为跨节点访问没有代价。

## 11 把机房拓扑变成资源预算

### 11.1 存储吞吐经过哪几个边界

```text
计算节点 → 机架交换机 → 上联及核心网络 → 存储机架 → 存储节点
```

机架内带宽与跨机架带宽可能不同。网络超售比例，是接入侧潜在总流量与上联能力之间的关系。即使每台机器都配高速网卡，也不意味着所有机器同时跨机架发送时都能满速。

“二分带宽”关注把网络分成两部分后，两部分之间可用的总通信能力。分布式存储要利用大量节点吞吐，既需要设备并行，也需要足够的网络承载能力。

### 11.2 一个假设机房的计算

假设有 8 台存储服务器，每台 8 块 SSD，每块在目标负载下持续读取 3 GB/s，则设备侧简单相加为 192 GB/s。

如果每台服务器只有一张 100 Gbit/s 网卡，每台原始发送上限为 12.5 GB/s，8 台合计 100 GB/s。即使忽略其他开销，跨网络对外供数也不可能达到设备合计的 192 GB/s。

若两组机架之间只有 4 条 100 Gbit/s 上联，且所有相关数据都必须跨越这条边界，原始上限又降为 50 GB/s。这个算例中的限制来自共享边界，而非某块 SSD。

### 11.3 为读 写和恢复分别记账

三副本链式写入一份大小 S 的数据，在简化拓扑下会产生：客户端到链头 S、链头到中间节点 S、中间节点到链尾 S。每一跳是否经过同一上联，取决于副本位置。

这不能简化成“每张网卡都消耗三倍”，但可以提醒我们：需要按具体链路累计流量。

恢复也要预算。假设一台节点有 20 TB 数据需要重建，有效重建速率为 2 GB/s，仅数据移动下限约为 10000 秒，即 2.78 小时。校验、读放大、限流和业务争用可能继续延长时间。

### 11.4 故障域与性能域

两份副本位于不同进程，不一定能抵抗服务器故障；位于不同服务器，不一定能抵抗同一机架电源故障。副本放置需要对应希望承受的故障域。

跨机架放置提高某些故障隔离能力，也消耗更多跨机架流量。设计需要在正常读写、故障切换和重建期间都算一遍资源。

建议维护一张机房事实表：

| 范围 | 至少记录的内容 |
| --- | --- |
| 计算节点 | GPU、CPU、NUMA、NIC及其连接关系 |
| 存储节点 | SSD、持续性能、容量、耐久度、NIC |
| 网络 | 每层链路、超售、可用路径、拥塞配置 |
| 故障域 | 服务器、机架、交换机、电源域 |
| 共享负载 | 推理、训练通信、checkpoint、迁移与恢复 |

## 12 分布式存储的基本形态

### 12.1 为什么要跨机器

单机容量、带宽和故障承受能力都有边界。分布式存储通过多节点聚合资源，同时把一部分复杂性转移到网络、元数据、复制和恢复协议中。

它需要解决的核心问题是：怎样定位数据，怎样保持所承诺的一致性，怎样在局部故障后继续提供服务，以及怎样把资源分配给多个工作负载。

### 12.2 块 文件和对象接口

| 接口 | 应用看到什么 | 常见操作 |
| --- | --- | --- |
| 块存储 | 一段逻辑块地址空间 | 按地址读写块 |
| 文件存储 | 路径、目录、文件、偏移 | open read write rename |
| 对象存储 | key 与对象内容 | put get delete |

接口与内部实现不能画等号。文件系统可以把文件拆成对象保存；对象服务也可以把对象放进本地文件。使用 hash key 不代表底层必定使用哈希表，也不代表具备何种一致性。

对象 API 的覆盖、列表、一致性和范围读取能力，需要按具体服务确认，不能仅根据“对象存储”这个名字推断。

### 12.3 控制路径 元数据路径和数据路径

控制路径维护成员、配置和版本；元数据路径管理名字、权限、布局；数据路径搬运内容。它们可以由不同组件实现，也可能在同一进程内协作。

```text
客户端 ── 查名字及布局 ──→ 元数据服务
客户端 ── 读取文件内容 ──→ 存储服务
管理组件 ── 配置与成员版本 ──→ 各组件
```

元数据不必为每个数据包重新查询，但客户端缓存布局后，就需要处理布局过期和版本变化。

### 12.4 缓存与主存储承担不同责任

缓存通常允许丢失，因为数据可以重读或重算。主存储可能保存唯一数据，需要更严格的持久化与恢复策略。

但“缓存可以丢”只表示可以退化为未命中，不能表示可以返回错误内容。对推理而言，重算会增加延迟，复用了错误 KV 则可能改变输出或暴露其他请求的数据。

## 13 数据如何分片和放置

### 13.1 分片 条带和副本

假设文件按 4 MiB 拆成 chunk，依次分散到多组存储位置。分片减少单节点容量压力，条带化允许大文件访问多个目标，副本为同一内容保留多份。

```text
文件：chunk0 chunk1 chunk2 chunk3
放置：组 A   组 B   组 C   组 A
每组内部：多个副本
```

条带宽度大，可能让单文件更容易利用并行资源，也可能增大请求扇出和管理开销。条带宽度不等于“这次读取会同时访问这么多节点”，实际还取决于读取范围和布局。

### 13.2 用算式拆出chunk范围

对 chunk 大小 C、起始偏移 o、长度 l：

```text
起始 chunk = o // C
chunk 内偏移 = o % C
本段长度 = min(剩余长度, C − chunk 内偏移)
```

例如 C 为 4 MiB，从文件 3 MiB 处读取 3 MiB，要读 chunk0 的最后 1 MiB，以及 chunk1 的最初 2 MiB。逻辑上一个读取，实际可能变成两个远端子请求。

### 13.3 映射表和确定性计算

一种方案为每块存储完整的位置映射，另一种方案记录布局参数，再由客户端计算。前者定位灵活但元数据量较大，后者减少映射记录但需要稳定的布局规则和版本管理。

一致性哈希、固定分组、链表和放置算法都是可选工具。不能只看“是否用了 hash”，还要看扩容时迁移多少数据、热点能否打散以及故障域是否满足。

### 13.4 纠删码的容量与代价

概念上的 k+m 纠删码把数据编码为 k 个数据片与 m 个冗余片；对合适的编码，任意 k 个有效片可以重建数据。容量放大约为 `(k+m)/k`。

例如假设采用 8+2，容量放大约为 1.25。三副本的容量放大约为 3。两者不能只比较容量：小写入、修复读取量、CPU 编码成本、片分布与尾延迟也不同。

分片的故障容忍以编码条件和放置策略为前提。把多个片放在同一故障域，可能让一次机架故障同时损失多个片。

## 14 一致性 持久性和事务

### 14.1 用历史描述正确性

假设客户端 A 写入 `x=2` 并成功返回，然后客户端 B 才开始读 x。线性一致性的要求之一是，B 不能再读到这个操作之前的值，除非中间还有其他写入。

并发操作可以按某个合法顺序解释；已经具有明确先后关系的操作不能随意颠倒。这里的“强一致性”应落到具体对象、操作和文档保证，不要当作覆盖一切的形容词。

### 14.2 四个经常混用的保证

| 保证 | 所回答的问题 |
| --- | --- |
| 一致性 | 不同观察者看到的操作顺序是否合法 |
| 原子性 | 一个更新是否只表现为完整成功或未发生 |
| 持久性 | 已确认修改在规定故障模型下能否恢复 |
| 隔离性 | 并发事务能否按约定方式相互影响 |

一个系统可以让所有客户端一致地读到内存里的新值，但尚未持久化。也可以把多个片段都持久化了，却没有把它们原子地发布为一个新文件版本。

### 14.3 元数据事务解决什么

重命名可能同时涉及旧目录项、新目录项和引用信息。把它们放进具有所需隔离性的事务，可以让应用获得完整的命名空间操作。

FoundationDB 默认事务提供严格可串行化隔离，并通过冲突检测使部分并发事务重试。事务代码中的外部副作用需要单独处理：数据库重试不能撤回已经发送的消息或已经写出的文件。[FoundationDB 开发指南](https://apple.github.io/foundationdb/developer-guide.html)

元数据事务成功，也不会自动把另一个系统的数据写入纳入同一原子事务。跨数据面与元数据面的发布，仍需要定义协议。

### 14.4 CAP应该怎样读

在网络分区等条件下，系统不能同时保证相应模型中的线性一致性和所有非故障节点请求都完成。这里的可用性是理论定义，不等同于日常 SLA 百分比。

实际设计要具体讨论：哪些操作拒绝或等待，哪些允许返回旧值，分区恢复后怎样合并或修复。简单写一句“三选二”，不足以描述系统行为。[Gilbert 与 Lynch 对 CAP 的讨论](https://dspace.mit.edu/entities/publication/dfcb6512-af44-4fc9-8e8b-1a8f28f1b53a)

## 15 复制 共识和版本隔离

### 15.1 多写几份不等于协议完整

把数据发给 A、B、C 三个节点，只完成了搬运的一部分。系统还要决定：谁接收新写入，怎样排序，几份确认后返回，读取从哪里获得有效版本，以及故障后怎样重建成员。

如果 A 收到新版本、B 还没收到，客户端能否读 A 或 B，取决于系统承诺和协议状态。副本数量本身不能回答这个问题。

### 15.2 Raft提供什么

Raft 通过选主、日志复制和提交规则，帮助一组节点维护一致的复制日志。任期号用来识别过期领导者。多数派交集与完整的日志安全规则共同维护安全性，不能把协议简化成“只要任意多数节点存了就一定提交”。[Raft 论文](https://raft.github.io/raft.pdf)

并非所有大块文件数据都必须经过 Raft。系统可以用一致性服务维护成员和元数据，再由专门数据协议传输大块内容。

### 15.3 链式复制与CRAQ

概念上的链式复制把副本排列为头、中间节点和尾：

```text
客户端写 → A → B → C
                 提交与确认按协议传播
```

CRAQ 让多个副本参与读取。节点追踪版本及 clean/dirty 状态；如果本地最新状态还不能直接确认，读取需要按协议查询已提交版本等信息。它通过协议维护强一致性，不能解释为“任意副本无条件返回自己的最新值”。[CRAQ 原论文](https://pdos.csail.mit.edu/6.824/papers/craq.pdf)

### 15.4 旧领导者与fencing

假设旧服务因为网络故障失去管理权，但稍后恢复并继续发写入。仅在管理服务里换一个领导者还不够，实际接受写入的一方也需要拒绝旧权限。

一种常见思路是为配置或租约分配单调版本：

```text
旧持有者携带 epoch 12
当前配置要求 epoch 13
存储端拒绝 epoch 12 的修改
```

关键在于检查发生在真正执行修改的边界，并与状态转换协调。把版本号只打印在日志里，不会产生隔离效果。

## 16 超时 重试与幂等性

### 16.1 超时留下的是不确定结果

```text
客户端发送写入
服务端提交成功
响应在网络中丢失
客户端超时
```

此时直接把“超时”当“没发生”会产生错误推理。客户端需要查询结果、重试幂等操作，或者执行业务定义的补偿。

### 16.2 请求身份与内容身份

内容 hash 回答“这份数据是什么”，请求 ID 回答“这是哪一次逻辑操作”。两次操作可以写同一份内容，一个操作也可能更新多个对象。两种身份不能互相代替。

对同一请求 ID，服务端可以记录已完成结果；重试时返回原结果。若相同请求 ID 携带不同内容，应按协议拒绝，而不是默默复用旧结果。

去重记录也有生命周期。记录过早过期，延迟到达的重试就可能再次执行。若要求跨重启保持幂等，去重状态还要持久化或通过更强机制恢复。

### 16.3 重试需要预算

重试会消耗网络、设备和队列资源。服务端变慢时，所有客户端立即重试，可能把暂时拥塞放大成持续过载。超时、退避、抖动、重试上限和总 deadline 需要共同设计。

一次业务允许等待 1 秒，内部拆成多个阶段时，不能让每个阶段都各自拥有额外 1 秒而无限延长总体时间。

### 16.4 失败与恢复的三个对象

要分别恢复内容、元数据和成员状态。某节点恢复在线，不意味着其数据已经追上最新版本；某份数据存在，也不意味着应重新发布为当前版本。

恢复期间还需要限流和检查点，避免业务请求被重建流量完全挤占。判断稳定性应包含降级与重建阶段，而不只是所有节点健康时的测试。

## 17 把一次分布式读写走完整

### 17.1 教学用不可变版本模型

下面描述一个简化系统：文件有多个不可变版本，每个版本由若干 chunk 组成，manifest 保存当前版本的 chunk 列表。manifest 是描述内容组成与版本的元数据。

这是一种便于分析的设计，不代表所有文件系统或 3FS 的具体实现。

### 17.2 写入和发布

```text
1 生成新版本身份
2 把输入拆成 chunk
3 分配各副本的接收位置
4 传输并校验 chunk
5 达到规定的副本与持久化条件
6 原子更新 manifest 指向新版本
7 记录幂等结果并返回成功
```

这些步骤中，4 完成不能代替 5，5 完成不能代替 6。客户端应该何时获得成功，取决于服务承诺覆盖到哪一步。

如果在步骤 5 后、步骤 6 前失败，可能留下未发布的孤立 chunk。旧 manifest 仍然可用，后台以后再回收孤立内容。如果先发布 manifest 再写 chunk，读取者就可能看到不完整版本。

### 17.3 读取和验证

```text
1 获取某个确定版本的 manifest
2 根据偏移拆分 chunk 范围
3 查询或计算副本位置
4 并行读取并处理超时
5 验证版本 身份 长度和内容
6 按顺序组装并返回
```

读取过程中如果当前版本发生变化，应继续读取已经选定的版本，或按定义重试，避免把旧版前半段和新版后半段拼在一起。

### 17.4 回收和在途读取

删除 manifest 不等于可以立即释放 chunk。可能有读取者已经取得旧 manifest，还没完成读取。系统可以用引用、租约、epoch、宽限期或其他机制保护在途访问。

```text
已发布 → 不再被新请求引用 → 等待旧访问结束 → 可回收
```

这一条与异步 buffer 回收相同：业务上不再需要，并不能证明没有其他执行者仍然访问它。

## 18 缓存索引 身份和有效性

### 18.1 缓存命中需要同时满足哪些条件

一个缓存条目至少需要内容身份、位置、版本、长度、格式与有效状态。命中索引后，还要判断数据是否完整，访问者是否有权限，以及位置是否仍然有效。

```text
逻辑身份 → 位置及版本 → 数据已就绪 → 访问受到保护 → 可以使用
```

哈希通常由输入或内容产生。如果根据 token 计算出 key，再把 key 指向一块尚未写完的内存，key 正确也无法保证数据正确。

### 18.2 前缀树和哈希链

假设请求以 A、B、C 三个完整 token 块组成，普通因果 Attention 的 KV 通常依赖之前的上下文。可以使用：

```text
hA = Hash(命名空间, A)
hB = Hash(hA, B)
hC = Hash(hB, C)
```

这样，同一个 B 出现在不同前缀后面会得到不同身份。vLLM 的原生前缀缓存采用包含前缀依赖和额外标识的块哈希。[vLLM 前缀缓存设计](https://docs.vllm.ai/en/latest/design/prefix_caching/)

前缀树则把共享关系显式组织成路径。树的节点可以保存局部位置，外部存储仍可使用哈希 key。索引选择不决定内存回收是否安全，也不自动决定分布式一致性。

### 18.3 跨机器身份需要规范化

两个客户端需要约定：字节序列化方式、模型与权重版本、KV 数据类型、布局、分块边界、位置编码相关配置以及共享隔离域。哈希算法相同，但输入序列化不同，也不会得到同一个 key。

哈希碰撞、key 缺字段、陈旧映射、长度不匹配和传输覆盖，是不同故障，修复方法也不同。非加密校验和适合检测某些偶发损坏，但不能自动承担对抗性身份验证。

### 18.4 命中率的分母

请求命中率、token 命中率、字节命中率和省下的计算时间，都可能不同。一份很大的低频前缀，与很多很小的高频前缀，对资源的价值不同。

缓存策略可以考虑：复用概率、重算成本、占用空间、读取成本、写入成本与租户预算。LRU 只是按近期使用情况管理的一种策略，不能代替业务价值判断。

### 18.5 缓存一致性和访问隔离

文件内容会被修改时，内容缓存需要通过不可变版本、失效通知、租约、token 或其他协议避免返回旧值。仅设置一个 TTL，只限制旧值保留多久，不自动提供线性一致性。

多租户共享缓存时，要定义谁有权共享。命名空间或盐值可以隔离缓存身份，但它们不能替代文件权限、服务端授权与传输层保护。控制面请求不能因为带着某个 hash，就获得任意读取或写入权限。

校验和主要检查数据是否符合预期；身份验证检查请求者是谁；访问控制检查允许做什么。加密也不自动完成版本和长度验证。它们分别承担不同责任。

## 19 用基础知识理解3FS

### 19.1 四个组件放在什么位置

开源 3FS 设计把系统分为 Client、Cluster Manager、Meta Service 和 Storage Service。元数据服务使用事务型 KV 存储保存文件元数据；存储服务管理 SSD 上的 chunk；公开设计使用 CRAQ 复制。[3FS 架构说明](https://github.com/deepseek-ai/3FS/blob/main/docs/design_notes.md)

```text
                         Cluster Manager
                         成员 配置 版本
                              │
应用 → Client ── 元数据请求 ──→ Meta Service → 元数据存储
          │
          └──── 数据请求 ────→ Storage Service → 本地SSD
                                   ↕
                              其他复制成员
```

阅读时把问题分配给对应组件：名字与布局找 Meta；大块数据走 Storage；成员变化找管理组件；请求拆分和 buffer 生命周期先看 Client。

### 19.2 文件布局怎样减少中心依赖

公开设计中，文件被切成 chunk，布局关联复制链，客户端取得布局后计算后续访问位置。这是前面“元数据获取布局、数据请求直接访问目标”的具体应用。

分析自己的负载时，可以据此检查：小范围请求会拆成多少子请求，热点落在哪些组，副本跨越哪些故障域。这些是根据布局推导的问题，不能用单个通用参数替代。[3FS 布局说明](https://github.com/deepseek-ai/3FS/blob/main/docs/design_notes.md)

### 19.3 FUSE和USRBIO的数据路径

普通 FUSE 接口便于接入文件应用。3FS 的 USRBIO 在应用与 FUSE 进程之间使用共享数据内存 Iov 与请求环 Ior，提供批量异步数据 I/O。它并未让 FUSE 进程完全消失：fd 注册把应用的打开文件关联到对应对象，数据操作通过共享内存和队列协作。[USRBIO API](https://github.com/deepseek-ai/3FS/blob/main/src/lib/api/UsrbIo.md)

```text
元数据操作：应用 → 文件接口 → FUSE进程 → 元数据服务
USRBIO数据：应用 ↔ Iov数据内存及Ior请求环 ↔ FUSE进程 → 存储服务
```

学习 API 时，先确认 Iov 的拥有者、Ior 的并发使用方式、提交与收割完成的关系。写入前把数据准备到规定区域，读取后检查结果，结束时按依赖顺序排空请求再释放资源。

### 19.4 本地chunk引擎中的分配与回收

3FS 仓库中的 chunk engine 设计说明，把空间管理分为内存分配状态与持久化元数据，并使用引用保护读取中的 chunk 位置。分配、写入和持久化分配信息，按明确顺序完成；回收也有自己的持久化和引用规则。[Chunk Engine 说明](https://github.com/deepseek-ai/3FS/blob/main/src/storage/chunk_engine/README.md)

这里可以重新检查自己是否理解 alloc：领取位置、填充内容、发布元数据和允许回收，仍然是不同操作。通过持有引用保护一个位置，也不意味着对任意并发修改都天然安全，具体访问协议仍需要检查。

### 19.5 部署先分清角色和依赖

官方部署示例涉及元数据、管理、存储及客户端角色，并包含 RDMA 连通性和依赖服务配置。示例中的机器数量和硬件规格是部署范例，不应当作所有环境的固定最低配置。[3FS 部署指南](https://github.com/deepseek-ai/3FS/blob/main/deploy/README.md)

对一个新环境，先完成四张表：服务角色、持久化目录与设备、网络地址与端口、故障后的恢复责任。然后在隔离实验资源上验证创建、读写、校验、重启和恢复。能够挂载只证明客户端建立了入口，尚不能证明复制与恢复符合预期。

### 19.6 测试应覆盖实际采用的接口

通过普通文件接口执行 fio，与通过 USRBIO 引擎执行 fio，测试的是不同客户端路径。3FS 提供专用 fio 外部引擎，其 mountpoint 和批量参数需要按对应版本配置。[3FS fio 引擎说明](https://github.com/deepseek-ai/3FS/blob/main/benchmarks/fio_usrbio/README.md)

不要把普通 FUSE 路径的结果直接视为 USRBIO 上限，也不要把大批量峰值直接视为小请求延迟。连接方式、批量等待、在途请求数和应用数据准备时间都应计入对比。

## 20 用分布式存储保存推理KV

### 20.1 KV为何能复用

自回归模型在处理历史 token 时生成 Key 和 Value。保留历史 KV，可以在后续生成中避免重新计算这些历史投影。跨请求前缀复用，则进一步省去共享输入对应的部分 prefill 工作。

对普通全 Attention 结构，一个请求的 KV 大小可近似估算为：

```text
KV字节数 = 2 × 层数 × token数 × KV头数 × 每头维度 × 每元素字节数
```

假设 32 层、8 个 KV 头、每头 128 维、每元素 2 字节，每个 token 需要 128 KiB。4096 token 约为 512 MiB。这里未计管理开销与额外状态，也未处理分片、量化、MLA、滑动窗口或混合结构。

这个假设模型足以说明：把文本变成 KV 后，数据体积可能很大。缓存节省了计算，也增加了存储和搬运负担。

### 20.2 分层存储中的数据移动

一个常见路径是 GPU 保存活跃工作集，Host 保存较热数据，SSD 或远端保存更大工作集。LMCache 的公开架构就包含 GPU、CPU、本地与远端后端等层次。[LMCache 架构](https://docs.lmcache.ai/v0.3.7/developer_guide/architecture.html)

```text
远端或SSD → Host接收buffer → 格式转换 → GPU KV池 → Attention
```

也可能采用更直接的传输路径，但需要按具体硬件、驱动和接口验证。`O_DIRECT`、RDMA、USRBIO 和 GPUDirect Storage 不能互相代称。

### 20.3 读取是否划算

需要比较：

```text
定位 + 排队 + 读取传输 + 格式处理 + GPU加载
与
省下的重算时间
```

假设恢复 64 MiB，远端有效读取 5 GiB/s，单纯读取需要 12.5 ms。Host 到 GPU 假设 20 GiB/s，又需要 3.125 ms。若定位、排队和转换共 2 ms，串行估算为 17.625 ms。

如果重算要 40 ms，复用可能有收益；如果重算只需 10 ms，复用可能更慢。若各阶段能重叠，还要用实际依赖图计算关键路径，不能机械相加或假设完全重叠。

### 20.4 为什么chunk大小需要联合考虑

chunk 小，复用粒度细，但索引、RPC、队列与元数据开销更多。chunk 大，容易做大块传输，但可能读入大量当前不用的数据。

一个 32 MiB 存储对象里，当前只需要 4 MiB；如果每次必须读完整对象，应用层读放大就是 8。若支持范围读取，还要考虑是否破坏底层布局和校验方式。

KV 层可以把多个小块合并存储，再保存索引；也可以按层或 token 范围组织数据。选择需要结合复用模式、GPU Attention 布局、传输方式和回收粒度。

### 20.5 保存和发布KV的状态机

```text
生成中 → 内容完成 → 备份中 → 备份完成 → 可对外复用
                     │失败
                     └→ 清理未发布条目或按未命中处理
```

只有数据写入完成并满足相应条件后，才能发布可用索引。释放 GPU 源页之前，也要确认备份读操作不再使用它。

对缓存故障，优先定义“未命中并重算”的行为。错误恢复不能把半条缓存当完整命中，也不能为了保持命中率而绕过模型、版本或租户检查。

## 21 为机房和工作负载规划容量

### 21.1 从请求统计推导需求

至少采集输入和输出长度分布、KV 字节大小、到达率、共享前缀分布、命中长度、读写比例、保留时间、热点程度与时延目标。

平均值用于第一轮估算，峰值与分布用于容量边界。不要只用“每秒多少请求”，因为 100 个短请求与 100 个长上下文请求可能相差几个数量级。

### 21.2 一个完整假设算例

继续使用每 token 128 KiB 的假设模型，并假定：

| 参数 | 假设值 |
| --- | --- |
| 请求到达率 | 20 次每秒 |
| 远端命中请求比例 | 60% |
| 命中请求平均恢复长度 | 4096 token |
| 每个请求平均新增且准入缓存的数据 | 1024 token |
| 平均有效保留时间 | 6 小时 |
| 存储冗余方式 | 三副本 |
| 目标数据填充率 | 70% |

平均逻辑读取需求为 `20 × 0.6 × 4096 × 128 KiB`，即 6 GiB/s。平均新增逻辑写入为 `20 × 1024 × 128 KiB`，即 2.5 GiB/s。这里已经假设新增数据完成去重和准入筛选。

按稳定写入、近似固定平均驻留时间估算，6 小时保留量为 54000 GiB，约 52.73 TiB。三副本后约 158.20 TiB；再除以 70% 填充率，需要约 226 TiB 原始容量。

这个估算未包含索引、日志、碎片和额外工作区。LRU 的实际驻留时间也不是固定 TTL，需要用轨迹验证。不同冗余方案需要替换容量和流量放大系数。

### 21.3 流量不只有应用读取

```text
业务读取
+ 新增缓存写入
+ 副本传输或编码流量
+ 恢复与迁移
+ 校验与后台整理
+ 控制及元数据
= 各链路需要承载的总流量
```

不同流量可能经过不同链路，要按放置与路径分别累计。正常状态还有余量，并不保证节点故障后的流量仍可承受。

### 21.4 时延预算与预取

把首 token 预算拆给排队、查缓存、加载和计算。预取可以把读取与其他工作重叠，但会占用带宽和 buffer，并可能读取最后用不到的数据。

预取策略至少要明确：触发条件、最大在途量、超时、取消语义、部分命中边界和回收责任。只有具备这些限制，预取才不会在负载上涨时无限放大资源占用。

## 22 观测和验证方法

### 22.1 先写假设 再选指标

一个可验证的问题是：“客户端网络入口是否限制了大块读取？”需要采集的是相应网络端口速率、应用吞吐和并发变化。只看客户端磁盘 iostat，无法回答远端存储是否忙。

指标要注明采集位置、单位、累计或瞬时含义、时间窗口和是否包含后台负载。应用字节、网络字节和设备字节因为缓存与放大，通常不会完全相等。

### 22.2 测试矩阵

| 变量 | 可选择的对照 |
| --- | --- |
| 请求大小 | 4 KiB 128 KiB 1 MiB |
| 访问模式 | 顺序 随机 真实轨迹 |
| 并发 | 实际在途数逐步增加 |
| 缓存 | 明确哪层预热或未命中 |
| 接口 | 普通文件路径 USRBIO |
| 集群状态 | 正常 降级 恢复中 |

每次只改变少量因素，保存完整配置和结果。不同接口可能需要不同的最优批量策略，但报告应同时给出可比配置与各自调优后的结果。

### 22.3 三种经常发生的误判

刚写完就读，不一定是冷读；设置 `direct=1`，不等于所有层缓存都消失；队列加深后延迟变大，不足以判定磁盘有问题。

此外，吞吐上升可能来自更多客户端聚合，不能用集群聚合值描述单请求或单节点表现。P99 也不能把各节点的 P99 简单求平均后当成总体 P99。

### 22.4 证据不足时怎样下结论

如果只看到客户端，可以定位本机 CPU、内存或入口链路的部分问题。网卡不满不能排除远端网络拥塞；远端请求耗时高也不能直接解释成介质延迟。

一个合适结论可以是：“在当前工作负载和客户端观测下，本机端口未饱和；增加实际并发后吞吐进入平台，瓶颈位于未进一步分解的远端服务路径。”保留这个范围，比给出没有证据的磁盘归因更有用。

## 23 四个可运行的基础实验

以下 Python 实验只使用标准库，前三个使用临时目录或内存，第四个完全在单进程中运行。把代码分别保存为所示文件名，再用 `python3 文件名.py` 执行。它们也作为独立脚本随本文提供。

正常执行可以验证代码路径和断言，但不能证明真实断电、网络分区或 RDMA 设备故障下的安全性。需要验证这些条件时，应建立隔离故障实验，并明确故障模型和检查规则。

### 23.1 观察路径与打开文件的身份

把下面代码保存为 `01_file_identity.py`。实验先打开旧文件，再用新文件替换相同路径。观察旧 fd 和重新访问路径读到什么，最后删除路径，再检查旧 fd。

```python
"""Observe path replacement and open-file identity; no third-party packages."""
import os
import tempfile
from pathlib import Path


def main():
    with tempfile.TemporaryDirectory(prefix="storage-identity-") as directory:
        root = Path(directory)
        target = root / "data.bin"
        replacement = root / "next.bin"
        target.write_bytes(b"old-version")
        fd = os.open(target, os.O_RDONLY)
        try:
            old_inode = os.fstat(fd).st_ino
            replacement.write_bytes(b"new-version")
            os.replace(replacement, target)
            old_data = os.pread(fd, 64, 0)
            new_data = target.read_bytes()
            assert old_data == b"old-version"
            assert new_data == b"new-version"
            assert os.fstat(fd).st_ino == old_inode
            target.unlink()
            assert not target.exists()
            assert os.pread(fd, 64, 0) == b"old-version"
            print("old fd reads:", old_data.decode())
            print("new path reads:", new_data.decode())
            print("PASS: an open fd retains its object after replacement/unlink")
        finally:
            os.close(fd)


if __name__ == "__main__":
    main()
```

预期旧 fd 读到 `old-version`，新路径读到 `new-version`；删除路径后，旧 fd 仍然能读。这说明名字与已打开对象的生命周期不同。实验适用于支持这些 Unix 文件语义的环境。

延伸任务：分别用两次 `open()` 和一次 `open()` 加 `dup()` 比较读偏移，解释为什么后一种会共享偏移。

### 23.2 按顺序发布一个文件版本

把下面代码保存为 `02_durable_replace.py`。它在目标同目录写唯一临时文件，处理短写，再同步文件、替换路径并同步目录。

```python
"""Single-file publication pattern for Linux local filesystems.

Normal execution verifies bytes, not power-loss durability. The filesystem and
storage must implement the documented fsync/rename semantics.
"""
import hashlib
import os
import tempfile
from pathlib import Path


def durable_replace(target: Path, data: bytes):
    fd, temp_name = tempfile.mkstemp(prefix=".pending-", dir=target.parent)
    try:
        remaining = memoryview(data)
        while remaining:
            written = os.write(fd, remaining)
            if written <= 0:
                raise OSError("write made no progress")
            remaining = remaining[written:]
        os.fsync(fd)
        os.close(fd)
        fd = -1
        os.replace(temp_name, target)
        flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
        parent_fd = os.open(target.parent, flags)
        try:
            os.fsync(parent_fd)
        finally:
            os.close(parent_fd)
    finally:
        if fd >= 0:
            os.close(fd)
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def main():
    with tempfile.TemporaryDirectory(prefix="storage-publish-") as directory:
        target = Path(directory) / "published.bin"
        for data in [b"version-1\n", b"version-2\n" * 1024, b""]:
            durable_replace(target, data)
            assert target.read_bytes() == data
        print("sha256:", hashlib.sha256(target.read_bytes()).hexdigest())
        print("PASS: publication sequence and byte checks completed")
        print("This is not a power-loss or crash-consistency proof.")


if __name__ == "__main__":
    main()
```

普通运行预期完成三个版本的内容检查，其中包括空文件。实验面向支持相关语义的 Linux 本地文件系统；其他环境如果目录同步不受支持，应理解差异，不能删除同步步骤后仍声称拥有原保证。

延伸任务：在纸上列出每一步之后进程退出或机器掉电的可能结果。区分进程退出和系统断电，因为进程退出后内核仍可继续写回数据。

### 23.3 复现提前复用buffer

把下面代码保存为 `03_buffer_lifetime.py`。事件用来确定性地控制“提交之后、读取源 buffer 之前”的窗口，而不是依靠不稳定的 sleep 时序。

```python
"""Deterministic buffer-lifetime demonstration, not a real DMA engine."""
import asyncio


async def delayed_write(source, started, release):
    started.set()
    await release.wait()
    return bytes(source)


async def scenario(reuse_early):
    source = bytearray(b"AAAA")
    started = asyncio.Event()
    release = asyncio.Event()
    task = asyncio.create_task(delayed_write(source, started, release))
    await started.wait()
    if reuse_early:
        source[:] = b"BBBB"
    release.set()
    observed = await task
    if not reuse_early:
        source[:] = b"BBBB"
    return observed


async def main():
    wrong = await scenario(True)
    correct = await scenario(False)
    assert wrong == b"BBBB"
    assert correct == b"AAAA"
    print("reused before completion:", wrong.decode())
    print("reused after completion: ", correct.decode())
    print("PASS: retaining a buffer includes retaining its required contents")


if __name__ == "__main__":
    asyncio.run(main())
```

错误版本得到 `BBBB`，正确版本得到 `AAAA`。虽然 Python 对象始终存活，错误版本仍然修改了异步操作需要保留的内容。内存生命周期既包括地址有效，也包括内容在约定期间稳定。

延伸任务：增加两个并发任务共用 buffer，先写出预期所有权规则，再用事件制造冲突。若加入取消操作，应等工作排空后再复用空间。

### 23.4 一个有版本和副本的小型存储模型

把下面代码保存为 `04_versioned_store.py`。每个节点用字典保存对象，chunk 固定为 4 字节，仅为了方便观察拆分。写入全部副本成功后发布不可变 manifest；读取选择有效副本并校验完整结果。

它还模拟了“服务端已经提交，但响应丢失”，用请求 ID 返回先前结果。写入者由本地锁串行化，manifest 与请求结果保存在进程内；这里没有实现真实网络、磁盘持久化、共识或跨节点原子事务。

```python
"""In-process teaching model: immutable chunks, all replicas, manifest publish.

No network, disk durability, election, CRAQ, distributed transaction, or automatic
garbage collection is implemented. A local lock serializes writers. Receipts and
manifests are volatile. Do not use this as a production storage implementation.
"""
import hashlib
from dataclasses import dataclass


def digest(data):
    return hashlib.sha256(data).hexdigest()


class Node:
    def __init__(self, name):
        self.name = name
        self.online = True
        self.objects = {}

    def put(self, key, data):
        if not self.online:
            raise ConnectionError(self.name)
        if key in self.objects and self.objects[key] != data:
            raise ValueError("immutable object identity reused")
        self.objects[key] = data


@dataclass(frozen=True)
class Chunk:
    key: tuple
    length: int
    checksum: str


@dataclass(frozen=True)
class Manifest:
    version: int
    length: int
    checksum: str
    chunks: tuple


class Store:
    def __init__(self):
        import threading
        self.nodes = [Node("A"), Node("B"), Node("C")]
        self.manifests = {}
        self.receipts = {}
        self.next_version = 0
        self.writer_lock = threading.Lock()

    def write(self, name, data, request_id, lose_response=False):
        fingerprint = (name, digest(data))
        with self.writer_lock:
            if request_id in self.receipts:
                old_fingerprint, version = self.receipts[request_id]
                if old_fingerprint != fingerprint:
                    raise ValueError("same request ID with different operation")
                return version
            self.next_version += 1
            version = self.next_version
            chunks = []
            for index, offset in enumerate(range(0, len(data), 4)):
                part = data[offset:offset + 4]
                key = (name, version, index)
                for node in self.nodes:
                    node.put(key, part)
                chunks.append(Chunk(key, len(part), digest(part)))
            # This local lock and in-process state model a single atomic publish.
            self.manifests[name] = Manifest(
                version, len(data), digest(data), tuple(chunks)
            )
            self.receipts[request_id] = (fingerprint, version)
            if lose_response:
                raise TimeoutError("committed, but response was lost")
            return version

    def read(self, name):
        # One immutable manifest snapshot; do not reread it for every chunk.
        manifest = self.manifests[name]
        parts = []
        for chunk in manifest.chunks:
            valid = None
            for node in self.nodes:
                if not node.online:
                    continue
                part = node.objects.get(chunk.key)
                if (part is not None and len(part) == chunk.length
                        and digest(part) == chunk.checksum):
                    valid = part
                    break
            if valid is None:
                raise IOError("no valid replica")
            parts.append(valid)
        data = b"".join(parts)
        if len(data) != manifest.length or digest(data) != manifest.checksum:
            raise IOError("manifest validation failed")
        return data


def expect_error(error_type, operation):
    try:
        operation()
    except error_type:
        return
    raise AssertionError(f"expected {error_type.__name__}")


def main():
    store = Store()
    v1 = store.write("file", b"old-data", "request-1")
    assert store.read("file") == b"old-data"
    store.nodes[1].online = False
    expect_error(ConnectionError, lambda: store.write(
        "file", b"new-data", "request-2"))
    assert store.manifests["file"].version == v1
    assert store.read("file") == b"old-data"
    store.nodes[1].online = True
    expect_error(TimeoutError, lambda: store.write(
        "file", b"new-data", "request-2", lose_response=True))
    version = store.manifests["file"].version
    assert store.write("file", b"new-data", "request-2") == version
    expect_error(ValueError, lambda: store.write(
        "file", b"different", "request-2"))
    key = store.manifests["file"].chunks[0].key
    store.nodes[0].objects[key] = b"BAD!"
    assert store.read("file") == b"new-data"
    for node in store.nodes:
        node.objects[key] = b"BAD!"
    expect_error(IOError, lambda: store.read("file"))
    store.write("empty", b"", "request-empty")
    assert store.read("empty") == b""
    print("PASS: normal read/write, failed publish, lost response, retry dedup,")
    print("request conflict, corrupt-replica fallback, all-corrupt failure, empty file")


if __name__ == "__main__":
    main()
```

预期验证八种情况：正常读写、失败写入不发布、响应丢失、重试去重、同 ID 不同操作被拒绝、单副本损坏后换副本、全部损坏后报错，以及空文件。

特别观察失败写入可能留下一部分未发布 chunk。它们没有出现在当前 manifest 中，但仍占据模拟节点空间。这就是孤立数据回收问题的起点。

延伸任务按顺序做：为对象增加统计；列出未被 manifest 引用的对象；给旧版本读者增加引用；最后设计不会误删在途读取的 GC。不要先添加“超过 10 秒就删”，再假设所有读取都能在 10 秒内结束。

## 24 Linux文件I/O实验

### 24.1 准备专用测试目录

本节只对专用目录内的新文件操作，不使用裸设备，也不需要全局清理缓存。测试文件约为 1 GiB。先确认目录有空间，且所在文件系统符合想研究的路径；tmpfs、远端文件系统和本地 SSD 应分别记录。

将第一行替换为已经允许使用的实验目录。在同一 shell 中执行后续命令：

```bash
STORAGE_SCRATCH="/替换为你的实验目录"
export STORAGE_LAB_DIR="$(mktemp -d "$STORAGE_SCRATCH/storage-lab.XXXXXX")"
findmnt -T "$STORAGE_LAB_DIR"
df -h "$STORAGE_LAB_DIR"
fio --version
```

这里使用 `STORAGE_LAB_DIR` 保存本次临时目录，不要把其他已有数据目录当成输出文件。

### 24.2 实际写入测试数据

```bash
fio --name=prepare \
  --filename="$STORAGE_LAB_DIR/data.bin" \
  --rw=write --size=1G --bs=1M \
  --ioengine=psync --direct=0 \
  --refill_buffers=1 --end_fsync=1 \
  --group_reporting
```

这是准备步骤，不把它的结果当作持续写入性能。`refill_buffers=1` 让 fio 更新写入 buffer，减少简单重复内容造成的某些偏差；压缩和去重的影响仍应根据实际后端检查。`end_fsync=1` 请求结束时同步文件，且不负责清空读取缓存。

fio 数值单位受配置影响，本例使用默认 1024 进位，`1G` 表示 1 GiB。若原始配置修改了 `kb_base`，必须连同单位一起核对。[fio 官方参数文档](https://fio.readthedocs.io/en/latest/fio_doc.html)

### 24.3 连续两次缓冲读取

```bash
fio --name=buffered-read \
  --filename="$STORAGE_LAB_DIR/data.bin" \
  --rw=read --size=1G --bs=1M \
  --ioengine=psync --direct=0 --invalidate=0 \
  --allow_file_create=0 --readonly \
  --group_reporting
```

重复这条读取命令两次，并观察缓存、CPU和外部流量。由于准备步骤已经写入文件，第一次也可能是热读。这里没有把任何一次命名为“冷读”。

显式设置 `invalidate=0`，避免 fio 默认尝试在开始前使文件缓存失效。该选项不会主动预热，也不能控制所有文件系统及远端缓存。

### 24.4 直接读取和实际并发

对支持相应直接 I/O 的 Linux 文件系统，可以执行：

```bash
fio --name=direct-read \
  --filename="$STORAGE_LAB_DIR/data.bin" \
  --rw=read --size=1G --bs=1M \
  --ioengine=libaio --direct=1 --iodepth=16 \
  --allow_file_create=0 --readonly \
  --group_reporting
```

分别调整 `iodepth` 为 1、4、16、32，并保留实际深度分布、带宽和延迟。平台不支持引擎或直接 I/O 时，记录错误和原因，不把失败后随意更换的路径视为同一种测试。

这个 1 GiB、单遍实验可能很短，而且后端可能已经缓存它。它的用途是练习参数和观测，不是报告生产稳态性能。扩大规模前，应先建立容量、持续时间与共享负载预算。

### 24.5 看哪些指标

| 指标 | 可以帮助判断 | 不能单独证明 |
| --- | --- | --- |
| fio 带宽与延迟 | 应用看到的完成表现 | 哪个底层组件慢 |
| 各核心 CPU | 单核或客户端软件压力 | 内存带宽已经饱和 |
| 存储端口字节速率 | 数据是否经过该链路 | 远端是否读取介质 |
| 服务端设备统计 | 向对应设备发出的 I/O | SSD 内部是否命中缓存 |
| 内存控制器计数 | DRAM 流量与拓扑压力 | 哪份数据具体被缓存 |

`iostat` 的 `%util` 对现代并行 SSD 或阵列不能直接解释成性能上限；应结合吞吐、队列、延迟和负载变化。[iostat 说明](https://man7.org/linux/man-pages/man1/iostat.1.html)

### 24.6 3FS专项实验的下一步

普通文件实验完成后，再按仓库版本编译 USRBIO fio 引擎，在相同数据集上比较接口路径。记录批量大小、等待策略、ring 数量、Iov 大小、NUMA 位置和真实应用时延。

之后才进入故障实验：先在隔离集群中验证单进程重启，再验证节点离线、链路故障和恢复。每项实验都必须有明确检查：哪些已经确认的数据必须保留，哪些未确认操作可以成功也可以失败，错误是否能被检测。

## 25 自测题与答案

### 25.1 文件与I/O

**问题 1：打开 100 GiB 文件，会立即占用 100 GiB 内存吗？**

通常不会。打开建立文件访问状态，不等于把全部内容驻留内存；后续预读、映射访问或应用主动读取会改变内存占用。

**问题 2：改名后，旧 fd 是否自动指向同名新文件？**

不会。旧 fd 保留对原对象的引用。路径再次查找可能得到另一个对象。

**问题 3：一次 read 申请 4 KiB，只返回 1 KiB，一定是错误吗？**

不是。程序需要根据接口语义处理短读、文件末尾和错误。需要完整范围时，应检查累计字节数。

**问题 4：刚写完文件后的第一次读取，一定是冷读吗？**

不是。写入已经可能把数据放进文件缓存；“冷”必须指定哪层缓存。

**问题 5：direct 与 async 能同时成立吗？**

能。一个描述缓存路径，一个描述完成交互方式。仍要管理 buffer 并检查实际支持情况。

**问题 6：O_DIRECT 完成，为什么还可能需要 fsync？**

因为设备可能存在易失性写缓存，文件元数据也有同步要求。直接路径不自动提供完整的持久化承诺。

**问题 7：fsync 文件后，新文件名就一定持久化了吗？**

不一定。目录项持久化可能需要同步父目录，并确认文件系统对相应序列的语义。

**问题 8：mmap 返回，文件就全在内存了吗？**

不是。映射与驻留是不同状态，实际访问仍可能产生缺页和 I/O。

### 25.2 内存 网络和性能

**问题 9：业务请求取消后，能立即复用它的 DMA buffer 吗？**

只有确认所有相关操作不再访问后才可以。取消等待不等于取消已提交硬件操作。

**问题 10：哈希 key 正确，buffer 内容就一定正确吗？**

不是。可能没写完、被旧任务覆盖，或映射已经过期。身份和内容有效性需要分别验证。

**问题 11：把线程绑到 NUMA 节点 0，内存一定在节点 0 吗？**

不一定。内存分配策略、实际触页和已有内存位置都要检查。

**问题 12：200 Gbit/s 就等于 200 GB/s 吗？**

不是。先除以 8 得到 25 GB/s，再考虑进位单位和有效载荷开销。

**问题 13：100000 IOPS 一定比 50000 IOPS 带宽高吗？**

不一定。需要乘以各自的实际请求字节数，并考虑完成口径。

**问题 14：提高队列深度后吞吐不变，延迟上升，能确定磁盘慢吗？**

不能。只表明某处形成了资源限制和排队，需要进一步定位。

**问题 15：网卡没满，能排除网络问题吗？**

不能。远端上联、拥塞、重传和其他共享路径都可能限制供数。

### 25.3 分布式协议

**问题 16：三份数据都存在，就一定具备强一致性吗？**

不是。还要有排序、提交、读取和成员变更规则。

**问题 17：写入超时后，服务端一定没有提交吗？**

不是。可能只是响应丢失，需要查询或按幂等协议重试。

**问题 18：请求 ID 和内容 hash 为什么不能互相代替？**

请求 ID 标识逻辑操作，内容 hash 标识内容。操作副作用与数据身份的范围不同。

**问题 19：元数据服务是无状态的，系统就不需要持久化了吗？**

不是。状态可以保存到外部数据库；无状态通常描述服务进程，而非整个系统。

**问题 20：副本在三台服务器，是否一定能承受一个机架故障？**

不一定。如果三台服务器共用同一机架电源或网络故障域，就可能一起失效。

**问题 21：CRAQ 任意副本读，是否可以直接返回本地尚未提交的新版本？**

不能这样推断。需要按 clean/dirty 等协议状态确认可返回的已提交版本。

**问题 22：删除 manifest 后，可以立即删除所有旧 chunk 吗？**

不一定。旧读取者可能仍持有旧版本，需要等待在途引用或租约结束。

**问题 23：缓存可丢，为什么还要校验？**

可丢意味着可以未命中并重算，错误内容却可能产生错误结果。两个失败后果不同。

### 25.4 3FS与推理

**问题 24：普通 FUSE fio 结果是否等于 USRBIO 上限？**

不是。客户端路径、批量策略和共享内存机制不同，需要分别测量。

**问题 25：USRBIO 是否意味着应用再也不需要 FUSE 进程？**

不是。公开 API 通过应用与 FUSE 进程间的共享内存和 ring 协作。

**问题 26：KV 存储 chunk 越大，性能是否一定越好？**

不是。大 chunk 降低某些请求开销，也可能增加读放大和无用数据。

**问题 27：命中率从 60% 提高到 90%，TTFT 是否一定降低？**

不是。还要看命中长度、读取成本、排队和重算成本。

**问题 28：一个基准的平均值更好，是否足以证明适合在线推理？**

不足。需要检查尾延迟、时延目标下的有效吞吐、混合负载与故障表现。

**问题 29：容量留出 30% 空间，就能保证恢复期间性能吗？**

不能。容量、恢复带宽、设备读写压力和网络边界分别需要预算。

**问题 30：完成本教程后，第一次读3FS源码应从哪里开始？**

选定一个接口，追踪一次带偏移的读取：fd 怎样关联文件，范围怎样拆分，位置怎样确定，buffer 怎样获得，完成怎样返回，错误怎样清理。先跑通一条路径，再扩展到并发、写入与故障。

## 26 术语表 学习里程碑和参考资料

### 26.1 术语表

| 术语 | 本文中的含义 |
| --- | --- |
| buffer | 操作用来读取或填入数据的内存区域 |
| ownership | 谁负责资源使用与最终回收的约定 |
| fd | 进程的文件描述符 |
| inode | 文件对象的元数据身份及组织结构 |
| offset | 对象内部的字节位置 |
| extent | 一段连续逻辑范围到存储范围的映射 |
| Page Cache | Linux 中缓存普通文件内容的内存机制 |
| pagepool | GPFS 自行管理的数据与元数据缓存区域 |
| dirty | 已修改但尚需按相应规则写回或提交的状态 |
| writeback | 把缓存修改写向后端的过程 |
| readahead | 依据访问规律提前读取 |
| Direct I/O | 按文件系统支持的直接路径执行文件数据 I/O |
| durability | 在指定故障模型下保留已确认修改的能力 |
| atomicity | 操作表现为完整发生或未发生的性质 |
| linearizability | 操作可以按保持实时先后关系的合法顺序解释 |
| transaction | 按约定原子性与隔离性执行的一组操作 |
| WAL | 为恢复而先记录日志的设计方法 |
| CQE | 某项异步工作完成的记录 |
| QD | 在指定层次的在途请求数 |
| IOPS | 每秒完成的 I/O 操作数 |
| throughput | 单位时间完成的工作量或字节数 |
| tail latency | 分布尾部请求的延迟表现 |
| FTL | SSD 内部逻辑地址到闪存位置的转换层 |
| write amplification | 下层写入量相对上层逻辑写入量的放大 |
| NUMA | 内存访问代价与 CPU 或节点位置有关的体系结构 |
| RPC | 把调用变成远端消息交互的机制 |
| RDMA | 依据注册和权限，由网卡执行特定内存数据访问 |
| MR | 注册的 RDMA 内存区域 |
| metadata | 描述名字、布局、属性和状态等的信息 |
| chunk | 分布式系统分片与放置的逻辑数据单位 |
| stripe | 把连续数据分散到多个目标的组织方式 |
| replica | 同一逻辑内容的副本 |
| erasure coding | 用数据片与冗余片恢复丢失内容的编码方法 |
| manifest | 描述某版本内容组成的元数据 |
| epoch | 用于区分配置或权限代次的版本身份 |
| fencing | 在执行边界阻止旧权限继续修改资源 |
| idempotency | 重试逻辑操作不会重复产生不应重复的效果 |
| fault domain | 可能被同一故障同时影响的一组资源 |
| FUSE | 通过内核接口由用户态进程实现文件系统的机制 |
| USRBIO | 3FS 的用户态 ring 数据 I/O API |
| Iov | USRBIO 共享数据内存区域 |
| Ior | USRBIO 请求通信 ring |

### 26.2 按成果推进的学习里程碑

| 阶段 | 要完成的成果 | 进入下一阶段的条件 |
| --- | --- | --- |
| 文件基础 | 文件身份实验和读写路径图 | 能独立解释 fd、偏移、缓存和持久化 |
| 异步基础 | buffer 生命周期实验与状态图 | 能说明提交、完成、取消和回收条件 |
| 硬件基础 | 一台机器与一组机架的资源图 | 能做单位换算和资源上界估算 |
| 分布式基础 | 带版本、副本和幂等重试的模型 | 能分析失败写入、丢响应和旧读取 |
| 3FS接入 | 一个选定接口的完整读写追踪 | 能检查布局、提交、结果与清理 |
| 推理结合 | KV工作负载描述与容量时延预算 | 能解释复用在什么条件下有收益 |
| 机房验证 | 正常、降级和恢复阶段的对照报告 | 结论有配置、数据和明确适用范围 |

### 26.3 参考资料

基础资料适合按问题查阅，不必一次通读全部。实现细节以所使用版本为准。

| 主题 | 一手资料 |
| --- | --- |
| 操作系统总览 | [OSTEP](https://pages.cs.wisc.edu/~remzi/OSTEP/) |
| 文件数据结构 | [File System Implementation](https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf) |
| 崩溃一致性 | [Crash Consistency](https://pages.cs.wisc.edu/~remzi/OSTEP/file-journaling.pdf) |
| SSD基础 | [Flash based SSDs](https://pages.cs.wisc.edu/~remzi/OSTEP/file-ssd.pdf) |
| 文件接口 | [open](https://man7.org/linux/man-pages/man2/open.2.html) [read](https://man7.org/linux/man-pages/man2/read.2.html) [write](https://man7.org/linux/man-pages/man2/write.2.html) |
| 持久化与命名 | [fsync](https://man7.org/linux/man-pages/man2/fsync.2.html) [rename](https://man7.org/linux/man-pages/man2/rename.2.html) |
| 映射与异步 | [mmap](https://man7.org/linux/man-pages/man2/mmap.2.html) [io_uring](https://man7.org/linux/man-pages/man2/io_uring_setup.2.html) |
| 设备缓存 | [Linux Writeback Cache Control](https://docs.kernel.org/block/writeback_cache_control.html) |
| NUMA | [Linux NUMA](https://docs.kernel.org/mm/numa.html) |
| RDMA | [NVIDIA RDMA Programming Guide](https://networking-docs.nvidia.com/doca/archive/3-5-0/rdma-aware-networks-programming-guide) |
| 共识与复制 | [Raft](https://raft.github.io/raft.pdf) [CRAQ](https://pdos.csail.mit.edu/6.824/papers/craq.pdf) |
| 元数据事务 | [FoundationDB Developer Guide](https://apple.github.io/foundationdb/developer-guide.html) |
| 3FS总览与设计 | [3FS仓库](https://github.com/deepseek-ai/3FS) [Design Notes](https://github.com/deepseek-ai/3FS/blob/main/docs/design_notes.md) |
| 3FS客户端 | [USRBIO API](https://github.com/deepseek-ai/3FS/blob/main/src/lib/api/UsrbIo.md) |
| 3FS本地存储 | [Chunk Engine](https://github.com/deepseek-ai/3FS/blob/main/src/storage/chunk_engine/README.md) |
| 3FS部署与测试 | [Setup Guide](https://github.com/deepseek-ai/3FS/blob/main/deploy/README.md) [fio USRBIO](https://github.com/deepseek-ai/3FS/blob/main/benchmarks/fio_usrbio/README.md) |
| 通用基准 | [fio Documentation](https://fio.readthedocs.io/en/latest/fio_doc.html) |
| 推理缓存 | [vLLM Prefix Caching](https://docs.vllm.ai/en/latest/design/prefix_caching/) [LMCache Architecture](https://docs.lmcache.ai/v0.3.7/developer_guide/architecture.html) |

下一次面对一个真实读写请求，可以从应用传入的地址与长度开始，把所有映射、拷贝、等待和状态转换逐项画出来。再在每个边界写上：成功意味着什么，失败后谁负责，哪些资源仍然不能回收。这张图就是读懂和改进系统的起点。
