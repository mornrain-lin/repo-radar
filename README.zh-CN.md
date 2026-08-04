# RepoRadar

> 找出你的 GitHub 仓库为什么拿不到应有的 Stars —— 并精确告诉你该怎么改。

[![零依赖](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen)](package.json)
[![许可证: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![测试](https://img.shields.io/badge/tests-70%2F70-passing-brightgreen)](test)
[![GitHub Action](https://img.shields.io/badge/action-composite-lightgrey)](#作为-github-action-使用)

**RepoRadar** 对任意公开 GitHub 仓库打出 **100 分制** 的总分，覆盖 **5 个维度、27 项检查**，
并给出一份按"可挽回分数"排序的 *"优先修复清单"* —— 不是按严重程度的戏码排，而是按"每修一项能拿回几分"排。

和大多数"仓库健康"工具不同，RepoRadar 真正在乎 **可发现性（discoverability）**：
决定别人点不点进来的搜索元数据、topics、社交预览图，以及首屏 README。
一个技术上完美却没人找得到的仓库，依然是个失败的项目。而这部分，大多数 linter 都视而不见。

- ✅ **零依赖。** 只用 Node.js 内置模块（`fetch`、`node:crypto`、`node:fs`、`node:test`…）。没有安装负担，没有可审计面，没有可碎的东西。
- ✅ **对初学者友好。** 每一项检查都附带大白话的 `why` 和具体可执行的 `hint`。代码量小、注释充分，是拿来**读**的。
- ✅ **CLI、库、GitHub Action，三选一。** 怎么顺手怎么来。
- ✅ **诚实的工程实践。** 指数退避 + 抖动重试、尊重限流响应头、响应缓存 10 分钟、永不硬编码 token。

---

## 目录

- [安装](#安装)
- [快速上手](#快速上手)
- [示例输出](#示例输出)
- [命令行参数](#命令行参数)
- [输出格式](#输出格式)
- [作为库使用](#作为库使用)
- [编写你自己的检查项](#编写你自己的检查项)
- [27 项检查一览](#27-项检查一览)
- [架构](#架构)
- [作为 GitHub Action 使用](#作为-github-action-使用)
- [本地开发](#本地开发)
- [安全](#安全)
- [许可证](#许可证)

---

## 安装

```bash
# 作为 CLI 使用（无需全局安装，npx 按需拉取）
npx repo-radar nodejs/node

# 或者全局安装
npm install -g repo-radar

# 或者克隆后直接运行（无构建步骤 —— 纯 ES 模块）
git clone https://github.com/mornrain-lin/repo-radar.git
cd repo-radar
node bin/repo-radar.js nodejs/node
```

**环境要求：** Node.js ≥ 18.17（已在 18 / 20 / 22 上测试）。发布版包无需 `npm install` —— 它零依赖。

> 💡 **关于 Token。** RepoRadar 没有 token 也能跑（GitHub 允许匿名 60 次/小时）。设置 `GITHUB_TOKEN` 后上限提升到 5,000 次/小时，并可读取私有元数据。Token **只**从 `GITHUB_TOKEN` 环境变量或 `--token` 参数读取 —— 永不落盘、永不打印。

---

## 快速上手

```bash
# 扫描单个仓库
npx repo-radar sindresorhus/ky

# 每次 push 时，用自己的仓库做一次 CI 质量门禁
npx repo-radar "$GITHUB_REPOSITORY" --min-score 75

# 一次对比多个仓库
npx repo-radar sindresorhus/ky axios/axios --compare

# 生成一份可分享的单文件 HTML 报告
npx repo-radar mornrain-lin/repo-radar --format html --output report.html
```

可接受的仓库写法（由 `parseRepoInput` 解析）：

| 输入 | 解析为 |
| :-- | :-- |
| `owner/repo` | `https://github.com/owner/repo` |
| `https://github.com/owner/repo` | `owner/repo` |
| `git@github.com:owner/repo.git` | `owner/repo` |
| `https://github.com/owner/repo/pull/123` | `owner/repo`（路径部分被忽略） |

---

## 示例输出

运行 `repo-radar sindresorhus/ky`（一个真实、流行、维护良好的仓库）会打印：

```
  RepoRadar · sindresorhus/ky
  🌳 Tiny & elegant JavaScript HTTP client based on the Fetch API

   78.9/100   B  Solid
  ██████████████████████████████████████████████████████░░░░░░░░░░░░░░

  ★ 17k   ⑂ 485   ◉ 0 open   ⬤ TypeScript

────────────────────────────────────────────────────────────────────────

  📖  Documentation        ███████████████████░   24.1/25
      ▲ Changelog                      No CHANGELOG file, but GitHub Releases carry written notes

  🔍  Discoverability      ████████████░░░░░░░░   14.9/25
      ✖ Homepage / docs link           No homepage URL
      ✖ README first impression        Missing an H1 title, status badges in the first screenful
      ✖ Social preview image           Using GitHub's auto-generated social preview
      ▲ Repository name                "ky": too short to be searchable

  🛠️  Engineering          ██████████████████░░   17.5/20
      ▲ Dependency manifest & lockfile Manifest package.json present, no lockfile committed
      ▲ Linter / formatter config      Only .editorconfig found

  🤝  Community            ███████████░░░░░░░░░    8.0/15
      ✖ Issue templates                No issue templates
      ✖ Pull request template          No pull request template

  💓  Maintenance          ███████████████████░   14.4/15
────────────────────────────────────────────────────────────────────────

  Fix these first (sorted by points recoverable)
  ...
```

完整 Markdown 报告见 [`docs/samples/sample-ky.md`](docs/samples/sample-ky.md)，HTML 见 [`docs/samples/sample-ky.html`](docs/samples/sample-ky.html)，原始结构化结果见 [`docs/samples/sample-ky.json`](docs/samples/sample-ky.json)。

---

## 命令行参数

```
repo-radar <owner/repo> [更多仓库...] [选项]
```

| 选项 | 别名 | 说明 |
| :-- | :-- | :-- |
| `--format <name>` | `-f` | `terminal`（默认）、`markdown`、`html`、`badge`、`json` |
| `--output <file>` | `-o` | 把报告写入文件而非 stdout |
| `--token <token>` | `-t` | GitHub token（建议用 `GITHUB_TOKEN` 环境变量） |
| `--only <list>` | | 只跑这些维度（逗号分隔） |
| `--skip <list>` | | 跳过这些检查 id（逗号分隔） |
| `--min-score <n>` | | 分数低于 `n` 时以退出码 1 结束 |
| `--compare` | | 每个仓库只打印一行摘要，而非完整报告 |
| `--concurrency <n>` | | 多仓库模式下的并发扫描数（默认 3） |
| `--no-cache` | | 绕过本地响应缓存 |
| `--cache-ttl <ms>` | | 缓存有效期（毫秒，默认 600000） |
| `--clear-cache` | | 删除所有缓存响应后退出 |
| `--list-checks` | | 列出每项检查及其权重后退出 |
| `--whoami` | | 显示 token 状态与限流预算后退出 |
| `--verbose` | `-v` | 显示通过的项和调试日志 |
| `--quiet` | `-q` | 抑制进度日志 |
| `--no-color` | | 关闭 ANSI 颜色（也尊重 `NO_COLOR`） |
| `--help` | `-h` | 显示帮助 |

**退出码：** `0` 成功 · `1` 低于 `--min-score`（或运行错误）· `2` 用法错误。

---

## 输出格式

```bash
repo-radar owner/repo --format terminal          # 彩色报告到 stdout
repo-radar owner/repo --format markdown -o r.md  # GitHub 风格 Markdown
repo-radar owner/repo --format html    -o r.html # 单文件、自包含
repo-radar owner/repo --format json              # 完整结构化结果
repo-radar owner/repo --format badge   -o b.svg  # 给 README 用的状态徽章
```

- **terminal** —— ANSI 彩色报告（管道输出或 `--no-color` 时自动关闭颜色）。
- **markdown** —— 可直接贴进 issue、PR 或 `GITHUB_STEP_SUMMARY`。
- **html** —— 单文件自包含：内联 CSS、内联 SVG 仪表盘，无外部资源。
- **json** —— 完整的 `ScanResult`（见 [docs/zh-CN/api.md](docs/zh-CN/api.md)），适合做看板或自己的脚本。
- **badge** —— 手绘 SVG 盾牌（`RepoRadar: 79/100 B`），可提交并嵌入你的 README。

---

## 作为库使用

RepoRadar 是个普通 npm 包。导入 `RepoRadar` 门面，或自己组合底层模块。

```js
// examples/01-basic-scan.js
import { RepoRadar } from 'repo-radar';

const radar = new RepoRadar({ token: process.env.GITHUB_TOKEN });

const result = await radar.scan('nodejs/node');
console.log(`${result.repository}: ${result.score}/100 (${result.grade})`);

// 挽回分数最高的一项修复：
const top = result.topFixes[0];
console.log(`修复 "${top.title}" 可拿回 ${top.weight - top.earned} 分。`);

// 以有界并发池扫描多个仓库：
const { results, errors } = await radar.scanMany(
  ['sindresorhus/ky', 'axios/axios', 'vuejs/core'],
  { concurrency: 3 },
);
```

底层积木也全部导出且文档完备：

```js
import {
  GitHubClient, collectRepoContext, parseRepoInput,
  scoreRepository, ALL_CHECKS, DIMENSIONS, selectChecks,
  renderMarkdown, renderHtml, renderBadgeSvg,
} from 'repo-radar';

const client = new GitHubClient({ token: process.env.GITHUB_TOKEN });
const context = await collectRepoContext(client, 'nodejs/node');
const result = scoreRepository(context, ALL_CHECKS);   // 纯函数，无 I/O
```

完整 API 见 [`docs/zh-CN/api.md`](docs/zh-CN/api.md)，五个可运行脚本见 [`examples/`](examples)（基础扫描、批量对比、自定义检查、多格式报告、CI 质量门禁）。

---

## 编写你自己的检查项

一个检查项就是一个小对象：`id`、`dimension`、`weight`、人类可读的 `title`、`why`，以及一个返回 `[0, 1]` 区间内 `ratio` 的 `run(context)` 函数。

```js
// my-rules.js
export const myChecks = [{
  id: 'uses-pnpm',
  dimension: 'engineering',
  title: 'Uses pnpm',
  weight: 4,
  why: '快速且严格的包管理器能让安装结果可复现。',
  run(ctx) {
    const has = Boolean(ctx.files?.['pnpm-lock.yaml']);
    return { status: has ? 'pass' : 'fail', ratio: has ? 1 : 0,
             message: has ? 'pnpm-lock.yaml 存在' : '缺少 pnpm-lock.yaml' };
  },
}];
```

```js
import { RepoRadar } from 'repo-radar';
import { myChecks } from './my-rules.js';

const radar = new RepoRadar({ checks: myChecks });
const result = await radar.scan('owner/repo');
```

就这么简单 —— 没有注册样板。`validateRegistry` 会对内置集合校验权重是否仍合计为 100（你自定义的集合按自己的尺度计分）。完整教程见 [`docs/zh-CN/writing-a-check.md`](docs/zh-CN/writing-a-check.md)。

---

## 27 项检查一览

权重合计为 100。每个维度的检查权重之和等于该维度总分。

| 维度 | 权重 | 衡量什么 |
| :-- | --: | :-- |
| 📖 文档 Documentation | 25 | 陌生人能否不看你脸色就装好、用起来？ |
| 🔍 可发现性 Discoverability | 25 | 有人能找到它吗？搜索元数据、topics、第一印象。 |
| 🛠️ 工程 Engineering | 20 | CI、测试，以及让贡献安全合入的卫生状况。 |
| 🤝 社区 Community | 15 | 项目是否准备好接受别人的帮助？ |
| 💓 维护 Maintenance | 15 | 它看起来还活着吗？提交、发布、待办、仓库状态。 |

| 检查 id | 维度 | 权重 | 标题 |
| :-- | :-- | --: | :-- |
| `readme-exists` | documentation | 4 | README 文件 |
| `readme-depth` | documentation | 5 | README 深度 |
| `readme-quickstart` | documentation | 5 | 安装与使用指引 |
| `license` | documentation | 5 | 开源许可证 |
| `contributing-guide` | documentation | 3 | 贡献指南 |
| `changelog` | documentation | 3 | 更新日志 |
| `description` | discoverability | 5 | 仓库简介 |
| `topics` | discoverability | 6 | 主题标签 |
| `homepage` | discoverability | 3 | 主页 / 文档链接 |
| `readme-headline` | discoverability | 4 | README 首屏 |
| `social-preview` | discoverability | 3 | 社交预览图 |
| `repo-name-quality` | discoverability | 4 | 仓库名质量 |
| `ci-workflow` | engineering | 6 | 持续集成 |
| `tests` | engineering | 5 | 测试套件 |
| `gitignore` | engineering | 2 | .gitignore |
| `dependency-manifest` | engineering | 2 | 依赖清单与锁文件 |
| `linter-config` | engineering | 3 | Linter / 格式化配置 |
| `editorconfig` | engineering | 2 | .editorconfig |
| `issue-template` | community | 4 | Issue 模板 |
| `pr-template` | community | 3 | PR 模板 |
| `code-of-conduct` | community | 3 | 行为准则 |
| `contributor-base` | community | 3 | 贡献者基数 |
| `discussions-or-support` | community | 2 | 支持渠道 |
| `recent-activity` | maintenance | 5 | 近期提交活跃度 |
| `release-cadence` | maintenance | 4 | 发布节奏 |
| `issue-backlog` | maintenance | 3 | Issue 待办健康度 |
| `active-status` | maintenance | 3 | 仓库状态 |

每项检查的理由见 [`docs/zh-CN/checks.md`](docs/zh-CN/checks.md)。

---

## 架构

```
bin/repo-radar.js        # 薄入口 —— 只设 process.exitCode，从不直接 process.exit
  └─ src/cli.js          # 手写参数解析（无框架），stdout=结果 / stderr=日志
       └─ src/index.js   # RepoRadar 门面：scan / scanMany / whoami / clearCache
            ├─ src/github/client.js     # GitHubClient：认证、重试+退避、限流感知
            ├─ src/github/collector.js  # collectRepoContext：扇出 API 调用、解析输入
            ├─ src/checks/*.js          # 5 个维度共 27 项检查（插件式注册表）
            ├─ src/score.js             # scoreRepository：纯函数评分引擎
            └─ src/report/*.js          # terminal / markdown / html / json / badge 渲染器
```

为什么这么设计 —— 详见 [`docs/zh-CN/architecture.md`](docs/zh-CN/architecture.md)：

- **评分引擎是纯函数。** `scoreRepository(context, checks)` 不碰网络、不碰文件系统、不读时钟。所以它能在毫秒内被彻底测试，你也能靠读它来理解。
- **检查注册表是唯一的真相来源。** 渲染器、CLI、评分器都遍历 `ALL_CHECKS`；没有任何地方硬编码检查 id。加一项检查只需改动一个文件。
- **失败是一等公民。** 抛异常的检查会变成 `status: 'error'` 且 0 分 —— 报告依然完整，bug 也依然可见。

---

## 作为 GitHub Action 使用

RepoRadar 以 **composite Action** 形式提供 —— 只是 shell 步骤，没有 Docker 镜像，没有打包的 JavaScript。几秒跑完，且你能逐行读到它将执行的每一行。

```yaml
# .github/workflows/quality-gate.yml
name: Quality gate
on: [push, pull_request]
jobs:
  radar:
    runs-on: ubuntu-latest
    steps:
      - uses: mornrain-lin/repo-radar@v1.0.0
        with:
          min-score: 75          # 质量回退时让构建失败
          format: markdown       # 同时发布到 job summary
```

| 输入 | 默认值 | 说明 |
| :-- | :-- | :-- |
| `repository` | `${{ github.repository }}` | 要扫描的 `owner/repo` |
| `token` | `${{ github.token }}` | 用于 API 调用的 GitHub token |
| `min-score` | _(空)_ | 分数低于此值时让 job 失败 |
| `format` | `markdown` | `terminal`、`markdown`、`json`、`html`、`badge` |
| `output` | _(空)_ | 写入报告的可选路径 |
| `job-summary` | `true` | 把报告发布到运行摘要页 |

输出：`score`、`grade`、`report`。详见 [`action.yml`](action.yml)。

---

## 本地开发

```bash
git clone https://github.com/mornrain-lin/repo-radar.git
cd repo-radar
node --test "test/*.test.js"    # 70 个测试，零依赖，无构建
node bin/repo-radar.js --version
node bin/repo-radar.js --list-checks
```

目录结构：

```
src/
  cli.js              # 参数解析 + 命令分发
  index.js            # 公开 API（RepoRadar 门面）
  github/             # client.js（HTTP）· collector.js（数据采集）
  checks/             # helpers.js + 5 个维度文件 + index.js（注册表）
  score.js            # 纯评分引擎
  report/             # terminal · markdown · html · badge · index（分发器）
  utils/              # colors · logger · format · cache
test/                # registry · score · checks · client（+ fixtures）
examples/             # 5 个可运行脚本
docs/                # 文档（zh-CN）
```

欢迎贡献 —— 见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

---

## 安全

- **Token 永不持久化。** RepoRadar 从环境读取 `GITHUB_TOKEN`（或命令行 `--token`），仅作为 `Bearer` 头传递。绝不写入缓存、日志或任何文件。
- **磁盘缓存只存响应**，以请求的 SHA-256 哈希为键。不含 token。并且受 TTL 约束、失败即降级（缓存出错会退化为实时请求，绝不崩溃）。
- **HTML 报告在注入标记前会转义所有来自仓库的文本**，所以恶意的仓库名或简介无法注入脚本。

漏洞请按 [SECURITY.md](SECURITY.md) 私下报告。

---

## 许可证

[MIT](LICENSE) © mornrain.lin —— mornrain.com · mornrain.cn
