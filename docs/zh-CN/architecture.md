# 架构（Architecture）

RepoRadar 的设计目标是 **"能读、能测、能改"**。下面解释各个模块为什么这样划分。

## 分层

```
bin/repo-radar.js        薄入口：只设 process.exitCode，从不直接 process.exit
  └─ src/cli.js          手写参数解析（无框架）；stdout 输出结果，stderr 输出日志
       └─ src/index.js   RepoRadar 门面：scan / scanMany / whoami / clearCache
            ├─ src/github/client.js      GitHubClient：Bearer 认证、指数退避+抖动重试、限流感知
            ├─ src/github/collector.js   collectRepoContext：扇出 API 调用、解析仓库输入
            ├─ src/checks/*.js           helpers.js + 5 个维度文件 + index.js（注册表）
            ├─ src/score.js              scoreRepository：纯函数评分引擎
            └─ src/report/*.js           terminal / markdown / html / badge / index（分发器）
```

## 设计原则

### 1. 评分引擎是纯函数

`scoreRepository(context, checks)` **不碰网络、不碰文件系统、不读时钟**。
它只做一件事：把已有数据变成结构化结果。

这意味着：

- 测试只需准备一个 `context` 对象，无需 mock 整个网络层；
- 你可以脱离 GitHub 离线运行（见 `test/fixtures/context.js` 的 `makeContext` / `makeEmptyContext`）；
- 评分逻辑可单独审阅、单独推理；
- 同一输入永远得到同一输出（确定性）。

`test/score.test.js` 用数十个用例在毫秒内覆盖它，正是得益于此。

### 2. 检查注册表是唯一的真相来源

所有 27 项检查都汇进 `ALL_CHECKS`（`src/checks/index.js`）。评分引擎、每个渲染器、CLI
**全部遍历这个数组**，没有任何地方硬编码某个检查 id。

后果：

- 加一项检查只动一个文件（对应维度的 `*.js`）；
- 删除/禁用一项检查不需要改引擎或报告代码；
- `validateRegistry` 作为单元测试运行，保证权重始终合计 100——防止有人加了个 7 分检查却悄悄把"百分制"变成 107 分。

### 3. 失败是一等公民

`runCheck` 用 try/catch 包住每个 `run()`。检查若抛异常，不会拖垮整个扫描，
而是记录为 `status: 'error'`、0 分，并在 `hint` 里提示"这是 RepoRadar 的 bug，请提 issue"。
**静默吞掉异常比崩溃更糟**——崩溃至少让你知道出了问题。

此外，对每个检查返回的 `ratio` 做 `clamp(0, 1)` 防御：一个返回越界值的 bug 检查，
无法把总分推过 100，从而悄悄污染每一份报告。

### 4. 输出与计算分离

`score.js` 产出 `ScanResult`；5 个渲染器（`report/*`）各自把它变成不同格式。
新增一种输出格式（比如 SVG 仪表盘、CSV）不需要改评分逻辑。

### 5. 健壮性是默认行为，不是开关

- **重试**：`GitHubClient` 对 5xx / 429 用指数退避 + 抖动重试，避免惊群；
- **限流感知**：读取 `x-ratelimit-remaining` / `x-ratelimit-reset`，逼近上限时主动退避；
- **缓存**：响应以 SHA-256 哈希为键缓存 10 分钟，永不存 token，且**失败即降级**——缓存出错退化为实时请求，绝不崩溃；
- **求值隔离**：多个仓库扫描用有界并发池（默认 3），避免触发 GitHub 二级限流。

### 6. 安全默认

- Token 只从环境变量 / `--token` 读取，永不落盘、永不打印、永不进缓存；
- HTML 报告在注入标记前转义所有仓库派生文本，防止 XSS。

## 数据流

```text
CLI 参数
   ↓ parseArgs
Repository 引用 ("owner/repo" / URL / SSH)
   ↓ parseRepoInput
owner/repo
   ↓ collectRepoContext（GitHubClient + FileCache）
RepoContext（仓库元数据 + README + 社区健康度 + 文件清单）
   ↓ scoreRepository（纯函数，遍历 ALL_CHECKS）
ScanResult（score / grade / dimensions / topFixes）
   ↓ 选中的渲染器
terminal / markdown / html / json / badge
```
