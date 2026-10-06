# 🐕 SlopHound

**嗅出你仓库里的 AI slop——然后清理掉。**

[![CI](https://github.com/Yizhimao626/slophound/actions/workflows/ci.yml/badge.svg)](https://github.com/Yizhimao626/slophound/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/slophound)](package.json)
[English](README.md)

Vibe coding 很爽，直到 slop 被发布上线。AI 助手会在代码里留下一种特定的烂摊子：永远跑不挂的假测试、`// 剩余实现略`、复制五遍的同一个工具函数、import 一个根本不存在的包、以及把每一行代码都当教程解说的注释。reviewer 发现不了它们，因为它们**看起来像正经工作**。

SlopHound 是一个**零依赖、完全离线**的 CLI：找出这些烂摊子，给仓库打 0–100 分，并且和市面上所有"只检测"的工具不同——**它会把能安全清理的部分直接清掉**。

```text
  slophound v0.1.0 — AI slop scanner

  Score   0/100  (F)
  Scanned 5 files · 71 lines · 6 rules · 9 findings

  MAJOR    no-assert-tests · 3 findings
    app.test.js:4
      test case contains no assertions — it cannot fail
      | test('calculates the total', () => {

  MAJOR    placeholder-code · 2 findings
    script.py:13
      stub body ("...") — this function does nothing
      | ...

  MINOR    broken-imports · 1 finding
    app.js:5
      package "some-package-that-is-not-installed" is not installed in any node_modules up to the project root
```

## 为什么不用 ESLint？

ESLint 按语言抓风格和 bug 模式，需要配一套插件生态。SlopHound 回答的是另一个问题：**"这个仓库里有多少没被人 review 过的 AI 残留？"**——跨 JavaScript / TypeScript / Python，零配置、零安装、零网络。它不替代 linter，它审计的是你的自动补全在你背后写了什么。

## 检测什么

| 规则 | 抓什么 | 严重度 |
|---|---|---|
| `no-assert-tests` | 没有任何断言的测试——"永远通过"的假覆盖率 | major |
| `copy-paste` | 仓库里重复出现的 8 行相同代码块 | major |
| `placeholder-code` | `...` / `todo!()` 存根、"此处省略 / 待实现"标记 | minor / major |
| `broken-imports` *(beta)* | 解析不到的相对导入；既没安装也没声明的包——幻觉 import 信号（仅 JS/TS、Python） | minor |
| `todo-sprawl` | 单文件堆积 5+ 个 TODO/FIXME/HACK 标记 | minor |
| `hallucinated-api` *(beta)* | 调用 `Math`/`JSON`/`console`/`os` 等对象上不存在的方法——如 `JSON.isValid()`、`Math.mean()` | info |
| `comment-ratio` | 注释占一半以上的文件 | minor |
| `slop-comments` | LLM 口水话注释和 emoji 标题（中英双语） | info |

支持语言：**JavaScript/TypeScript、Python、Go、Java、Rust、C#、Kotlin**（`slophound --list-rules` 查看矩阵）。严重度可在配置文件中按规则覆盖。

## 评分公式

```
100 − (每 1000 行加权发现数) × 8
权重：info 0.25 · minor 1 · major 3 · critical 8
```

等级：A+ ≥ 95 · A ≥ 85 · B ≥ 70 · C ≥ 50 · F < 50。公式刻意保持简单并印在 `--help` 里——**一个你算不出来的分数，就不值得信**。

## 快速开始

```bash
npx slophound .                      # 扫描当前仓库
npx slophound . --fail-on minor      # minor 及以上让 CI 失败
npx slophound . --fix-dry            # 预览 --fix 会删什么
npx slophound . --fix                # 真正清理（只删整行注释，绝不碰代码）
```

无需安装、无需配置文件、无需账号。要求 Node ≥ 18。

### CI 门禁

发现达到 `--fail-on` 严重度（默认 `major`）时退出码为 `1`，可直接接入任何 CI：

```yaml
- run: npx slophound . --fail-on major
```

也可以直接使用本仓库自带的 composite action：

```yaml
- uses: Yizhimao626/slophound@main
  with:
    path: src
    fail-on: minor
```

### 报告格式

- `--json` — 结构化结果（stdout）
- `--md [file]` — Markdown 报告，适合贴进 PR（默认 `slophound-report.md`）
- `--sarif [file]` — SARIF 2.1.0，可接入 GitHub code scanning
- `--list-rules` — 规则清单

### 存量仓库？用基线（baseline）。

老仓库天然满是历史问题，不可能一个迭代修完。拍一次快照，之后**只门禁新增 slop**：

```bash
npx slophound . --update-baseline slophound-baseline.json   # 一次性记录现状
npx slophound . --baseline slophound-baseline.json          # CI：只对新增 slop 失败
npx slophound . --prune-baseline slophound-baseline.json    # 已修复的问题自动移出基线
```

把基线文件提交进仓库。基线里的发现仍会出现在报告中（标记为已知问题），但不计入评分、不影响退出码。指纹包含规则的消息措辞——若未来升级改动了消息，重跑一次 `--update-baseline` 即可（更新日志会注明）。

### 配置

`--init` 生成 `slophound.config.json`；`.sloprc.json` 同样有效。`.gitignore` 风格的忽略规则同时支持 `--ignore` 与配置文件。

## 隐私与合规（设计层面保证）

- **100% 离线**：代码里不存在任何网络调用，你的源码永远不离开本机。
- **零遥测**：不收集任何数据，没有账号体系。
- **零依赖**：整个依赖树就是 Node 标准库——没有供应链风险。
- **`--fix` 保守**：只删除"注释独占整行"的行（注释前不能有代码），先用 `--fix-dry` 预览，绝不改动可执行行。
- MIT 许可，全部原创代码，与 GitHub / OpenAI / Anthropic 无任何关联。

## 编辑器集成

[`vscode/`](vscode/README.md) 内置了一个 **VS Code 扩展 MVP**：同一引擎的结果直接显示在 Problems 面板，支持工作区扫描命令、保存时刷新、严重度过滤和基线。当前从源码目录加载运行（无打包步骤），市场上架步骤见其文档。

## 自我要求

本仓库在 CI 里用 SlopHound 扫描自身（`npm run selfscan`），用同样的门禁约束自己——**自己提交的 slop 会让自己的 CI 挂掉**。

## 路线图

- [x] Go、Java、Rust、C#、Kotlin 支持
- [x] SARIF 输出（接入 code scanning）
- [x] `--baseline`：忽略存量问题，只门禁新增 slop
- [x] 幻觉 API 检测（常用全局对象，beta）
- [x] 幻觉 API 检测扩展到字面量（字符串/数字/数组）
- [x] VS Code 扩展（MVP，源码运行）
- [x] `--baseline` 自动瘦身（清理已修复的指纹）

欢迎 PR——见 [CONTRIBUTING.md](CONTRIBUTING.md)。每条新规则必须同时提供正、负两个 fixture。

## 关注更新

在 GitHub 上 **Watch → Custom → Releases** 即可在新规则/新语言发布时收到通知。

## 许可证

[MIT](LICENSE) © The SlopHound Authors
