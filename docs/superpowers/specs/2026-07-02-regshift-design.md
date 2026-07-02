# RegShift — Make Regulation Move（设计文档）

日期：2026-07-02 · 目标：UK AI Agent Hackathon EP5 × Conduct（DoraHacks #2272）Conduct Track £8,000
截止：2026-07-04 23:59 BST（= 07-05 06:59 北京）· 远程提交 · Solo（Ste Tang）+ Claude

## 一句话

新法规发布后，企业要花数周：法务读条款 → BA 映射系统 → 工程师翻代码 → 变更评估 → 合规留痕。RegShift 把这条链压到几小时：**法规 → 原子化义务 → 代码库影响定位（带证据）→ 变更提案+测试 → 人逐条审批 → 监管可用的审计追溯矩阵**。人保持掌控（Conduct 命题核心："while staying in control"）。

## Demo 叙事

EU AI Act 高风险义务 2026-08-02 生效（距 Demo Day 29 天）。"你们公司部署的 AI 客服（LibreChat）准备好了吗？" 现场对真实开源仓库跑分析。

## 战略定位

- 命题直接命中：Conduct 原文点名 "a new regulation" 场景
- 差异化：**默认全本地模型（Ollama）——代码与合规状况永不出内网**。Conduct 客户群（银行/SAP 厂）正是"不许把代码发给云端"的人群；其他队伍大概率套壳云 LLM
- Provider 无关：`LLM_BASE_URL` 兼容任何 OpenAI 式端点，评委有 key 可换大模型
- 远程可评：live 静态站（真实产物浏览+审批交互）+ 视频 + 一条命令本地复现

## 架构（3 单元）

### U1 流水线 CLI（TypeScript，`pipeline/`）

阶段化，每阶段落盘 JSON 检查点（`runs/<runId>/`），可断点续跑：

1. **parse-reg**：内置 EU AI Act 真实条款节选（Art.50 透明度、Art.12 日志、Art.14 人类监督、Art.15 稳健性、Art.13 部署者信息、Art.26 部署者义务，6-8 条）→ LLM 拆结构化义务 → zod 校验（失败重试≤3）→ 人工复核（诚实披露"义务库经人工复核"）
2. **map-code**：git clone 底座仓库（LibreChat，锁 commit）→ tree-sitter 切块（函数/类/路由/配置）→ **确定性探测器**（正则+AST：stores-user-data / renders-ai-output / logging-call / model-call / auth-gate / moderation / retention 等信号）→ BM25 词法索引
3. **match**：每条义务 → 混合检索（信号过滤 + BM25）取 top-K 候选位点 → LLM 逐对分类 {relevant?, status: gap|partial|compliant|n-a, evidence 引文, reason} → findings
4. **plan**：每个 gap → 变更提案（rationale / 涉及文件 / diff 草案或计划 / 测试要点 / 风险评级 / 工作量 S-M-L）；3-5 个重点缺口出真实可读完整 diff

原则：**确定性优先，LLM 只做窄分类**（小模型可靠域）。默认模型 qwen2.5-coder:7b（16GB M4 安全），embeddings 可选 nomic-embed-text，纯 BM25 亦可跑。

### U2 审查台 Web UI（React 19 + Vite + TS，`web/`，Vercel）

- 视图：Run 总览 → 义务清单 → 影响地图（义务↔文件双向）→ 提案详情（diff+证据）→ 逐条 ✓批准/✗驳回/⟳待议+备注 → 导出追溯矩阵+审计报告（MD/打印 PDF）
- 静态站加载真实 run 产物 JSON；审批状态 localStorage 持久化；全程真数据零 mock
- 设计方向：**"监管纸感 × 精密终端"**——纸色底、法律衬线标题、等宽数据网格、状态色（gap 红/partial 琥珀/compliant 绿）；企业级质感，非模板脸

### U3 提交材料（`submission/`）

GitHub 公开仓库（stetang98/regshift）· 2-2.5min 视频（Playwright 录制真跑+UI 走查）· README（架构图+诚实边界节）· DoraHacks 逐字段提交清单（用户既定格式）

## 产物 Schema（U1↔U2 合同）

- `run.json`：{runId, createdAt, regulation{title,version}, repo{name,url,commit,scope[]}, model{name}, stats}
- `obligations.json`：[{id:"OB-050-1", articleRef, title, actor, trigger, requirement, severity, sourceQuote, sourceUrl}]
- `codemap.json`：{files:[{path, lang, loc, chunks:[{id, kind, name, startLine, endLine, signals[]}]}]}
- `findings.json`：[{id:"F-001", obligationId, status, confidence, sites:[{file, startLine, endLine, evidence, reason}], summary}]
- `proposals.json`：[{id:"P-001", findingId, obligationId, title, rationale, riskLevel, effort, changes:[{file, kind, sketch, isFullDiff}], tests[]}]
- 审批（客户端）：{proposalId, decision, comment, decidedAt}
- 追溯矩阵由上述实时推导

## 测试

- vitest：探测器、义务 schema 校验、矩阵推导、BM25 检索
- 微型 fixture 仓库（10 文件）流水线冒烟测试（不依赖 LLM 的阶段全覆盖；LLM 阶段用 stub provider 测编排、用真跑测质量）
- Playwright：UI 关键流 E2E + 截图

## 错误处理

- LLM 输出 zod 校验失败 → 修复提示重试（≤3）→ 仍失败则标记 low-confidence 并落盘继续（不中断整个 run）
- Ollama 缺失/超时 → 明确报错 + replay 模式兜底
- 阶段检查点保证任意阶段崩溃可续跑

## 赏金勾选

Conduct（主攻）+ GCC Category 2（civic transparency 契合即勾）。Cantor8 £50 独立进行（`cantor8-lab/`）。排除：CoralOS（仅英国）、Fetch.ai（Devpost 已截止）、Bittensor、Kaspa。

## 时间表（剩 ~66h）

- 07-02：脚手架+阶段1-3+Ollama+首次真实 run ‖ UI agent 并行 ‖ Cantor8 agent 并行
- 07-03：阶段4+UI 合体+终版 run+测试+部署
- 07-04：视频+README+提交清单 → 白天提交（余量 >12h）

## 风险与对策

- IRL 评审风险：用户在 WhatsApp/Discord 问远程资格（已列用户 to-do）；无论答复如何，DoraHacks 提交照做（0 成本期权）
- 小模型质量：确定性脚手架压缩 LLM 职责面；审批 UI 本身就是"AI 会错、人来把关"的产品论点；README 诚实标注精度
- LibreChat 体量：scope 限定 `api/server`（routes/middleware/services 核心目录），config 控制在流水线可消化范围

## 用户 to-do（仅 3 件）

1. DoraHacks 报名 hackathon 2272
2. 群里问远程资格（WhatsApp / discord.gg/mJNCdXUByr）
3. 最后按清单填 BUIDL 表单 + Cantor8 Google Form
