# RegShift — DoraHacks 提交清单（逐字段照抄版）

> 提交入口：https://dorahacks.io/hackathon/2272/detail → 先点 **Register** 报名 → 再点 **Submit BUIDL**（或个人页 Create a new BUIDL 后关联到本比赛）
> 截止：**2026-07-04 23:59 伦敦时间 = 07-05 06:59 北京时间**。建议 7/4 白天提交完毕。
> 表单分五页：Profile → Details → Team → Contact → Submission。每页字段下面给出**可直接粘贴**的值。

---

## ① PROFILE 页

| 表单字段 | 填什么 |
|---|---|
| **BUIDL (project) name** | `RegShift` |
| **BUIDL logo** | 上传本仓库文件：`submission/assets/logo-480.png`（480×480 PNG，符合平台推荐尺寸） |
| **Vision**（Describe the problem which this project solves） | 复制下方 Vision 块 |
| **Category**（Key innovation domains，可多选/可输入） | 选/输入：`AI Agents`；若允许多个再加 `Developer Tooling`、`Enterprise Software` |
| **Infrastructures**（Layer-1s/L1s 等，全部 optional） | **全部留空**（本项目无链上部署，不要硬凑） |
| **Is this an AI Agent project?**（若有此问） | **Yes** |
| **GitHub** | `https://github.com/stetang98/regshift` |
| **Website** | `https://regshift.vercel.app` |
| **Demo video** | `<YOUTUBE_URL>`（视频上传后回填，见文末"待办#2"） |
| **X / Twitter** | `https://x.com/Stetang3438` |

**Vision 粘贴块（249 字符，问题先行）：**

【复制开始】
A new regulation means weeks of compliance archaeology: legal memos, system mapping, grepping legacy code, hand-built audit trails. RegShift does it in hours — obligations pinned to real code, human-approved fixes, regulator-ready traceability, fully local.
【复制结束】

---

## ② DETAILS 页

整页只需一次粘贴。**图片已用公开 GitHub raw 链接内嵌在文本里**，粘贴后自动显示，无需手动上传（若编辑器不渲染 `![]()` 语法，删掉那三行图片行，改用工具栏图片按钮上传 `submission/assets/screenshots/` 下的同名文件到相同位置）。

【复制开始】
# RegShift — Make Regulation Move

**A new regulation drops. Your enterprise codebase has weeks of compliance archaeology ahead — RegShift turns it into an afternoon, with a human approving every step.**

🔗 **Live console:** https://regshift.vercel.app · **Repo:** https://github.com/stetang98/regshift

## The slow enterprise process we picked (Conduct track brief)

Conduct asked us to pick a task enterprise teams spend **weeks** on and do it in **hours**. Ours is the one every regulated company just lived through with GDPR and is reliving with the EU AI Act: **regulatory change landing on a legacy codebase.** Today: legal reads the regulation → requirement memos → business analysts map systems → engineers grep an undocumented codebase → impact spreadsheets → change tickets → an audit trail assembled by hand. Weeks of specialist time per regulation, per system — and the EU AI Act's high-risk obligations start applying **2 August 2026**.

## What RegShift does

```
regulation text ─► atomic obligations ─► impact map on the real codebase (with evidence)
                                             │
  auditor-ready traceability matrix ◄─ human approves/rejects ◄─ change proposals + diffs
```

1. **parse-reg** — official article text → atomic obligations (actor, trigger, requirement, severity, **verbatim source quote**; all 24 quotes machine-verified against the official text).
2. **map-code** — AST-chunks the target repo; 13 deterministic signal detectors (stores-user-data, renders-ai-output, logging, …) + BM25 decide *where to look*. The model never free-ranges.
3. **match** — one obligation × one code site per LLM call, schema-validated: gap / partial / compliant / n-a, with quoted evidence.
4. **plan** — minimal change proposals; diffs are **compiled, not generated** (the model emits an insertion spec; RegShift builds the unified diff with exact hunk math — a 7B model can't produce broken diff syntax because it never writes diff syntax).
5. **review console** — a compliance officer walks obligation → evidence → proposal, approves/rejects each with comments, then exports the audit trail.

![RegShift dossier — real EU AI Act run against LibreChat](https://raw.githubusercontent.com/stetang98/regshift/main/submission/assets/screenshots/1-dossier.png)

## The demo is a real run, zero mocks

**EU AI Act (Regulation (EU) 2024/1689), 8 articles** vs **LibreChat** (production-grade self-hosted AI chat, the kind thousands of enterprises deployed since 2023), pinned commit:

- **267 files / 1,139 code chunks** scanned (354 Express routes extracted)
- **24 obligations** → **24 findings**: 17 gaps, 2 partial, 5 not-applicable
- **19 change proposals, every one with a compiled unified diff**
- **11 min 32 s wall-clock, entirely on a MacBook — zero cloud calls**

Flagship: **Art. 50(1)** (*users must be told they're talking to an AI*) — RegShift pins it to the exact two response controllers where disclosure belongs, quotes the evidence, and proposes the minimal insertion for a human to approve.

![Change proposal with compiled diff and human decision panel](https://raw.githubusercontent.com/stetang98/regshift/main/submission/assets/screenshots/2-proposal-diff.png)

## Human in control — structurally, not as a slogan

Nothing ships without a recorded human decision per change. The export is the artifact a regulator actually asks for: **obligation → code evidence → decision → timestamp**, downloadable as Markdown or print-to-PDF.

![Traceability matrix — obligation to code to decision](https://raw.githubusercontent.com/stetang98/regshift/main/submission/assets/screenshots/3-audit-matrix.png)

## Why local-first is the headline feature

The pipeline's default brain is **qwen2.5-coder:7b via Ollama, on-device**. The input to this tool is your proprietary codebase plus your compliance posture — the two things a bank or an SAP shop will never post to a cloud API. RegShift runs **air-gapped**; any OpenAI-compatible endpoint plugs in via two env vars if your compliance team clears a hosted model. (This is also why a small local model shaped the architecture: deterministic retrieval, narrow LLM duties, schema-validated outputs with self-repair, per-obligation checkpointing.)

## Honest limits

Verdicts are advisory with visible confidence; proposal quality is 7B-grade — which is exactly why the product is a review console with mandatory human decisions, not an auto-merger. Judgment stays human; RegShift removes the archaeology.

## Try it in 2 minutes

1. Open https://regshift.vercel.app — the dossier is a real run.
2. **Obligations** → expand *Art. 50(1)* — verbatim quote, severity, actor.
3. **Impact map** → same obligation — exact files + quoted evidence.
4. Open a **proposal** → read the compiled diff → **Approve** or reject.
5. **Audit** → *Export audit report* — your decision is in the matrix.

Repo (Apache-2.0, tests: 11 pipeline + 28 console): https://github.com/stetang98/regshift — reproduce with `ollama pull qwen2.5-coder:7b` + two commands (README).

## Regulation-agnostic by design

The corpus is a folder of sourced article files. Point it at DORA, PSD3, or your sector's rulebook — the obligation schema, matcher, and audit format don't change. (GCC bounty note: compliance transparency as open, forkable civic infrastructure.)

**Team:** solo — Ste Tang (GitHub [stetang98](https://github.com/stetang98) · X [@Stetang3438](https://x.com/Stetang3438)), built with Claude Code during the hackathon window. Design doc written before the first line of code: `docs/superpowers/specs/`.
【复制结束】

---

## ③ TEAM 页

| 字段 | 填什么 |
|---|---|
| Team | Solo builder（不新建团队，个人提交即可） |
| 成员介绍（若有输入框） | 复制下块 |

【复制开始】
Solo builder: Ste Tang — full-stack + applied-AI engineer. Shipped RegShift end-to-end during the hackathon window: pipeline (TypeScript + local Ollama), review console (React 19), tests (39 passing), security-reviewed, deployed. GitHub: stetang98 · X: @Stetang3438
【复制结束】

---

## ④ CONTACT 页

| 字段 | 填什么 |
|---|---|
| Telegram | `@Stetang` |
| Email（若问） | `stetang98@gmail.com` |
| WeChat（若有备用联系栏） | `SteForget` |

---

## ⑤ SUBMISSION 页

| 字段 | 填什么 |
|---|---|
| **Track** | 只有一个默认赛道，直接选它（页面可能显示 All BUIDLs） |
| **Bounties**（最多可勾 10 个） | 只勾 2 个：**Conduct Track: Make Legacy Move**（主攻）+ **GCC & ETH Bounty**（Category 2 AI for Good/civic transparency 契合）。其余不勾——不符合命题的赏金勾了也是陪跑，还稀释印象 |
| 若出现比赛自定义问答 | 远程参与相关：答 *Participating fully remote (confirmed allowed by organizers in the Q&A).*；仓库/视频是否公开：**Yes** |
| **Terms of Use / Participant Agreement** | 勾选同意 |
| 提交 | 点 Submit，看到 BUIDL 出现在比赛页即成功 |

---

## 你的待办（按顺序）

1. **报名**：比赛页点 Register（30 秒）
2. **上传视频到 YouTube**：文件 `video/regshift-demo.mp4`，逐字段照抄 `video/youtube-upload.md`（**Visibility 务必选 Unlisted**，别选 Private）→ 把链接回填到 Profile 页 Demo video 字段
3. 按本清单五页填完 → Submit
4. **Cantor8 £50 别忘了**（独立于本提交）：https://forms.gle/YMEr9rpZzq5fqxJDA 照抄 `cantor8-lab/form-answers.md`

## 提交前 3 分钟自检

- [ ] https://regshift.vercel.app 能打开且六个页面都有数据
- [ ] GitHub 仓库是 Public、README 首屏有 live/video 两个链接
- [ ] YouTube 视频链接非登录状态能播放（无痕窗口试一次）
- [ ] Details 页粘贴后三张图正常显示
- [ ] 只勾了 Conduct + GCC 两个赏金
- [ ] Telegram 填的是 `@Stetang`
