# 推广手册（LAUNCH）

目标：第一波真实用户 → 真实 issue → star 增长 → Release 订阅者。
原则：**只发真实内容，不买 star、不发机器人**（违反 GitHub ToS，且假数据会毁掉产品的可信度）。

## 发布顺序（重要）

1. npm 发布完成、CI 跑绿之后再推广——别人点进来第一眼是 README 和绿灯徽章
2. 中文区先发（V2EX / 掘金），修一轮反馈；再打英文区（Show HN / Reddit）——英文区流量大，机会只有一次，要用打磨过的版本
3. Show HN 选周二至周四的早上 8–10 点（美东时间）

## Show HN 模板（英文）

标题（二选一）：

```
Show HN: SlopHound – find and fix AI slop in your codebase
Show HN: I built a zero-dependency CLI that cleans up AI-generated mess
```

正文：

> Hi HN! After a year of vibe coding, my repos accumulated a specific kind of
> mess: tests with no assertions, "// rest of the implementation goes here",
> five copies of the same helper, imports for packages that don't exist.
> Reviewers miss these because they look like work.
>
> SlopHound is a zero-dependency, fully offline CLI that finds this residue,
> scores the repo 0–100, and removes what it can safely remove (slop comment
> lines) — with a dry-run diff first. It gates CI via exit codes.
>
> It scans JS/TS and Python with 6 rules, runs on the Node standard library
> only (zero npm dependencies, fully offline, no telemetry), and it scans
> itself in CI as its own regression test.
>
> Happy to answer questions about the heuristics — the hard part was tuning
> for zero false positives rather than recall.

第一评论里自己补一条：贴 `--fix-dry` 的输出示例。

## Reddit

- r/commandline、r/javascript、r/Python（各发一次，措辞按版规调整，别 crosspost 同一文本）
- 标题公式：`I wrote a zero-dependency CLI that finds and cleans AI slop in repos (JS/TS/Python)`
- 附真实终端截图；评论区保持高频回复前 2 小时

## V2EX 模板（分享创造节点）

标题：

```
[Vibe coding 一年后，写了个 CLI 把 AI 留下的烂摊子扫出来]
```

正文要点（用你自己的话改写）：

- 痛点：AI 写的代码"看着像工作"——假测试、`// 此处省略`、复制粘贴、幻觉 import
- 卖点：零依赖、完全离线（可以提一句代码里没有任何网络调用，源码可直接审计）、能自动清理、能接 CI
- 结尾：求 issues / star，欢迎提规则建议（尤其欢迎中文 slop 词库补充）

## 掘金 / 即刻

掘金发完整教程文（《我如何用 6 条规则量化 AI slop》角度，讲评分公式和启发式设计，比纯推广文传播好）。即刻发短动态 + 终端截图。

## X / Twitter

> Vibe coding left mess in every repo I own. So I built the tool I wanted:
> slophound — finds fake tests, placeholder code, copy-paste blocks &
> hallucinated imports. Zero deps, fully offline, cleans what it safely can.
> `npx slophound .` ← demo GIF

## 订阅（留资）机制

- GitHub：引导 **Watch → Custom → Releases**（README 已埋好），Release 是天然推送渠道
- 邮件：注册一个 Buttondown / listmonk（免费额度足够），把订阅链接填进 README 的 "Stay updated" 一节；只收邮箱、每封信带退订链接（合规底线）
- 给订阅者的第一封邮件：附一份"AI slop 自查清单"（把 6 条规则写成人工 checklist），换来的信任远大于一条营销邮件

## 内容复用（长尾流量）

1. 《AI slop 的 6 种形态》（把规则写成文章，HN/掘金都能发）
2. 《评分公式为什么是 100 − 密度×8》（透明度是差异化卖点）
3. 扫一个知名开源仓库的 slop 报告（只发数据不发评价，容易上热搜也容易引战——标题注明"无褒贬"）

## 节奏预期

- 发布当天：V2EX/Reddit 一波，几十到几百 star 是正常量级
- 第 1–2 周：回复所有 issue，快速出 0.2.0（用户提的规则被采纳是最好的增长燃料）
- 不要刷 star：GitHub 会清理虚假 star，被标记一次就再也上不了 Trending
