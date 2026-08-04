# 如何编写自己的检查项（Writing a Check）

RepoRadar 的检查项是**插件式**的：加一项检查只需改动**一个文件**，无需注册样板，引擎和报告会自动感知。

## 检查项长什么样

一个检查项是一个普通对象：

```js
{
  id: 'uses-pnpm',                 // 全仓库唯一，短横线命名
  dimension: 'engineering',        // 必须属于 5 个维度之一
  title: 'Uses pnpm',             // 人类可读的标题
  weight: 4,                      // 该维度内的分值（同维度合计需等于维度权重）
  why: 'A strict package manager keeps installs reproducible.', // 为什么重要
  run(ctx) {                      // 核心逻辑：返回 ratio 与状态
    const has = Boolean(ctx.files?.['pnpm-lock.yaml']);
    return {
      status: has ? 'pass' : 'fail',
      ratio: has ? 1 : 0,
      message: has ? 'pnpm-lock.yaml present' : 'No pnpm-lock.yaml',
      hint: has ? undefined : 'Run `pnpm install` to generate pnpm-lock.yaml.',
    };
  },
}
```

## `run(context)` 的契约

- 入参 `context` 是 `RepoContext`（见 `src/github/collector.js`），包含：
  - `repo`：GitHub API 返回的仓库对象（description、topics、homepage、stars…）
  - `readme`：README 原始文本（可能为 `null`）
  - `files`：根目录文件清单（以文件名索引）
  - `community`：社区健康度（贡献者数、issue/PR 模板是否存在…）
  - `collectedAt`：采集时间
- 返回值必须包含：
  - `status`：`'pass' | 'warn' | 'fail' | 'error'`
  - `ratio`：`[0, 1]` 区间内的数字，表示"完成度"
  - `message`：一句话当前状态描述
  - 可选 `hint`：**修复建议**（失败项必须有，这是 RepoRadar 的灵魂）
  - 可选 `evidence`：任意结构化数据，供报告或调试使用

辅助函数能让你写得更短：

```js
import { pass, warn, fail, graded } from 'repo-radar';

run(ctx) {
  if (ctx.files?.['pnpm-lock.yaml']) return pass('pnpm-lock.yaml present');
  return fail('No pnpm-lock.yaml', 'Run pnpm install to generate it.');
}
```

## 加权与排序如何工作

`earned = weight × ratio`。维度分 = 其下所有检查 `earned` 之和；总分 = 各维度分归一化到 100。

`topFixes`（报告里"优先修复"清单）**按丢分多少排序**：

```js
lost = weight - earned;   // 丢了多少分
```

所以"丢 4 分"会排在"丢 1 分"前面——哪怕后者权重更高。**对用户而言，先修回分最多的才划算。**

## 两种接入方式

### 方式 A：并入内置注册表（改源码，提交 PR）

在对应维度的文件（如 `src/checks/engineering.js`）里，把对象加进该维度的数组即可。
`validateRegistry` 会校验权重是否仍合计 100——加完记得调整同维度其他项权重，使总和不变。

### 方式 B：完全自定义集合（不改源码，最常用）

给 `RepoRadar` 传 `checks` 选项，直接替换内置注册表：

```js
import { RepoRadar } from 'repo-radar';
import { myChecks } from './my-rules.js';

const radar = new RepoRadar({ checks: myChecks });
const result = await radar.scan('owner/repo');
```

自定义集合按**自己的权重总和**归一化，不必凑满 100。适合公司内部规则、团队约定等场景。

## 一个完整的例子

`examples/03-custom-check.js` 演示了完整流程：定义一组自定义检查 → 用 `RepoRadar` 跑 → 打印报告。

## 编写检查项的 checklist

- [ ] `id` 全仓库唯一、短横线命名
- [ ] `dimension` 是 5 个已知维度之一
- [ ] `weight` 为正整数；若并入内置注册表，同维度合计须等于维度权重
- [ ] `why` 说清"为什么用户该关心"
- [ ] `run()` 返回合法 `status` 与 `[0,1]` 的 `ratio`
- [ ] 失败项带 `hint`（具体、可执行）
- [ ] `run()` 不抛异常；如可能出错，自行 catch 并返回 `error` 状态
- [ ] 不依赖网络/时钟/随机数——保持确定性，便于测试

## 测试你的检查项

因为引擎是纯函数，测试极其简单：

```js
import { scoreRepository } from 'repo-radar';
import { makeContext } from '../test/fixtures/context.js';
import { myChecks } from './my-rules.js';

const ctx = makeContext({ files: { 'pnpm-lock.yaml': '...' } });
const result = scoreRepository(ctx, myChecks);
// 断言 result.checks[0].status === 'pass'
```
