# 快速上手（Getting Started）

本指南带你从零跑通 RepoRadar，并理解它背后的心智模型。

## 1. 环境

- **Node.js ≥ 18.17**（18 / 20 / 22 均已验证）
- 无需 `npm install` —— RepoRadar 零运行时依赖、零开发依赖
- 可选：一个 GitHub token 提升 API 限额

## 2. 三种运行方式

### 方式 A：npx（最省事）

```bash
npx repo-radar sindresorhus/ky
```

首次运行会临时下载包，之后走缓存。

### 方式 B：全局安装

```bash
npm install -g repo-radar
repo-radar nodejs/node --format markdown -o report.md
```

### 方式 C：从源码（推荐想读代码的人）

```bash
git clone https://github.com/mornrain-lin/repo-radar.git
cd repo-radar
node bin/repo-radar.js nodejs/node
```

无构建步骤，纯 ES 模块直接跑。

## 3. 配置 Token（可选但推荐）

GitHub 匿名限额是 **60 次/小时**。带 token 后提升到 **5,000 次/小时**，还能读私有元数据。

```bash
# 推荐：用环境变量，绝不写进脚本或命令行历史之外
export GITHUB_TOKEN=ghp_xxx

# 或者用 --token 参数（注意：会出现在进程列表/历史里，仅临时调试用）
repo-radar owner/repo --token ghp_xxx
```

> **安全铁律**：token 只从 `GITHUB_TOKEN` 环境变量或 `--token` 读取，永不落盘、永不打印、永不进缓存。

## 4. 心智模型：分数怎么算

1. **采集**：`collectRepoContext` 向 GitHub API 扇出若干请求，收集仓库元数据、README、社区健康度等。
2. **评分**：`scoreRepository`（纯函数）把数据喂给 27 项检查，每项返回一个 `[0,1]` 的 `ratio`。
3. **加权**：`earned = weight × ratio`，按维度汇总后再归一化到 100 分。
4. **排序**：`topFixes` 按"丢了多少分"（`weight − earned`）降序排 —— **丢 4 分比丢 1 分更靠前**，即使后者权重更高。

```text
总分 100 = Documentation 25 + Discoverability 25 + Engineering 20 + Community 15 + Maintenance 15
```

## 5. 你的第一个扫描

```bash
# 扫一个仓库，看彩色报告
repo-radar sindresorhus/ky

# 只用可发现性维度，且打印所有通过项
repo-radar vuejs/core --only discoverability --verbose

# 多仓库横向对比
repo-radar sindresorhus/ky axios/axios vuejs/core --compare

# CI 质量门禁：低于 75 就让 job 失败
repo-radar "$GITHUB_REPOSITORY" --min-score 75
```

## 6. 下一步

- 想读懂每一项检查为什么存在 → [检查项详解](./checks.md)
- 想当库用、写自己的检查 → [API 文档](./api.md) 与 [如何写检查](./writing-a-check.md)
- 想理解整体设计 → [架构](./architecture.md)
