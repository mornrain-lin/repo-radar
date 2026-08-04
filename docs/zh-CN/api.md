# API 文档（Library API）

RepoRadar 同时是命令行工具和 npm 库。所有公开符号都从包根导出，也可按子路径导入。

## 顶层导出（package root）

```js
import {
  RepoRadar,
  GitHubClient, GitHubApiError, collectRepoContext, parseRepoInput, FileCache,
  scoreRepository, gradeFor, summarizeStatuses, GRADE_SCALE,
  ALL_CHECKS, DIMENSIONS, selectChecks, validateRegistry,
  logger, setLogLevel, LogLevel,
  renderTerminal, renderMarkdown, renderHtml, renderBadgeSvg,
  pass, warn, fail, graded,
} from 'repo-radar';
```

| 符号 | 说明 |
| :-- | :-- |
| `RepoRadar` | 高层门面类（见下） |
| `GitHubClient` | 底层 HTTP 客户端，处理认证、重试、限流 |
| `GitHubApiError` | 带 `isNotFound()` / `isRateLimited()` 的 API 错误 |
| `collectRepoContext` | 采集单仓库的全部数据 |
| `parseRepoInput` | 把 `owner/repo`、URL、SSH 远程解析成 `owner/repo` |
| `FileCache` | 基于 SHA-256 键、TTL 约束的磁盘缓存 |
| `scoreRepository` | **纯函数**：`scoreRepository(context, checks)` → `ScanResult` |
| `gradeFor` | `gradeFor(score)` → 等级条目 |
| `summarizeStatuses` | 按状态统计检查数量 |
| `GRADE_SCALE` | 等级阈值表 |
| `ALL_CHECKS` | 全部 27 项检查 |
| `DIMENSIONS` | 5 个维度的元数据 |
| `selectChecks` | 按维度/包含/排除过滤检查 |
| `validateRegistry` | 校验注册表（id 唯一、权重合计 100） |
| `logger` / `setLogLevel` / `LogLevel` | 分级日志（走 stderr） |
| `renderTerminal` / `renderMarkdown` / `renderHtml` / `renderBadgeSvg` | 各格式渲染器 |
| `pass` / `warn` / `fail` / `graded` | 在自定义检查里构造结果的辅助函数 |

## `new RepoRadar(options)`

| 选项 | 默认 | 说明 |
| :-- | :-- | :-- |
| `token` | `process.env.GITHUB_TOKEN` | GitHub token |
| `dimensions` | — | 只跑这些维度 |
| `include` | — | 只跑这些检查 id |
| `exclude` | — | 跳过这些检查 id |
| `checks` | — | 用自定义集合**完全替换**内置注册表 |
| `cache` | `true` | 启用磁盘响应缓存 |
| `cacheTtl` | `600000` | 缓存有效期（毫秒） |
| `baseUrl` | `https://api.github.com` | API 根，用于 GitHub Enterprise |
| `timeout` | — | 单次请求超时（毫秒） |

```js
const radar = new RepoRadar({ token: process.env.GITHUB_TOKEN });
```

### `await radar.scan(repository)` → `ScanResult`

扫描单个仓库。`repository` 可以是 `owner/repo`、GitHub URL 或 SSH 远程。
抛 `GitHubApiError`（404 / 401 等）时表示仓库不可读。

### `await radar.scanMany(repositories, { concurrency, onResult })`

以有界并发池扫描多个仓库（默认并发 3）。返回 `{ results, errors }`，
结果按输入顺序还原。`onResult(repo, result, error)` 在每一项完成时回调，便于流式输出进度。

### `await radar.whoami()` → `{ authenticated, login, scopes, limit, remaining }`

验证 token 并报告当前限流预算。

### `await radar.clearCache()` → `number`

清除磁盘缓存，返回删除的条目数。

## `ScanResult` 结构

```js
{
  repository: 'owner/repo',
  url: 'https://github.com/owner/repo',
  description: string | null,
  score: 78.9,                 // 0–100，一位小数
  grade: 'B',
  gradeLabel: 'Solid',
  gradeColor: '#84cc16',
  dimensions: [                // 5 个维度，仅含被选中的
    { key, label, emoji, summary, earned, weight, ratio, checks: [ScoredCheck] }
  ],
  checks: [ScoredCheck],       // 全部检查，扁平
  topFixes: [ScoredCheck],     // 按可挽回分数排序，最多 8 条
  stats: { stars, forks, watchers, openIssues, language, createdAt, pushedAt, scannedAt },
  warnings: string[],
}
```

`ScoredCheck`：

```js
{ id, dimension, title, weight, earned, ratio, status, message, hint?, why?, evidence? }
```

## 自定义检查辅助函数

```js
import { pass, warn, fail, graded } from 'repo-radar';

pass('pnpm-lock.yaml present');            // status='pass', ratio=1
fail('No pnpm-lock.yaml');                 // status='fail', ratio=0
warn('Only .editorconfig found', 0.5);     // status='warn', ratio=0.5
graded(0.75, 'Mostly there');              // 自定义 ratio
```

## 完整示例

见 [`examples/`](../../examples)：

- `01-basic-scan.js` —— 基础扫描
- `02-batch-compare.js` —— 批量对比
- `03-custom-check.js` —— 自定义检查
- `04-generate-reports.js` —— 多格式报告
- `05-ci-quality-gate.js` —— CI 质量门禁
