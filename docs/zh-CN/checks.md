# 检查项详解（The 27 Checks）

每一项检查都是一个对象：`id`、`dimension`、`weight`、`title`、`why`，以及一个 `run(context)` 函数。
`run` 返回一个结果：`status`（`pass` / `warn` / `fail` / `error`）、`ratio`（0–1）、`message`，以及可选的 `hint`（给用户的修复建议）。

权重合计为 100。下面是每个维度的逐项说明——这些文案也来自源码里的 `why` 字段。

## 📖 Documentation（权重 25）

> 衡量：陌生人能否不看你脸色就装好、用起来？

| id | 权重 | 标题 | 检查逻辑 |
| :-- | --: | :-- | :-- |
| `readme-exists` | 4 | README 文件 | 仓库根目录是否存在 README（含 README.md / .rst / .txt 等变体） |
| `readme-depth` | 5 | README 深度 | README 文本长度是否达到一定阈值（脱离 stub，约 2000 字符） |
| `readme-quickstart` | 5 | 安装与使用指引 | README 是否含安装指令与至少一段代码示例 |
| `license` | 5 | 开源许可证 | 是否声明许可证（SPDX 文件或 API 的 `license` 字段） |
| `contributing-guide` | 3 | 贡献指南 | 是否存在 CONTRIBUTING 文档 |
| `changelog` | 3 | 更新日志 | 是否有 CHANGELOG，或 GitHub Releases 含书面说明 |

**为什么文档占 25 分之多？** 因为没有文档的开源项目等于没有门口——别人进不来，star 和贡献都无从谈起。

## 🔍 Discoverability（权重 25）

> 衡量：有人能找到它吗？搜索元数据、topics、第一印象。

| id | 权重 | 标题 | 检查逻辑 |
| :-- | --: | :-- | :-- |
| `description` | 5 | 仓库简介 | `description` 是否非空且足够描述性 |
| `topics` | 6 | 主题标签 | 是否设置了不少于 N 个 topics（利于搜索与发现） |
| `homepage` | 3 | 主页 / 文档链接 | 是否设置了 `homepage` URL |
| `readme-headline` | 4 | README 首屏 | 首屏是否含 H1 标题、状态徽章、简短用法示例 |
| `social-preview` | 3 | 社交预览图 | 是否上传了自定义 1280×640 社交预览图 |
| `repo-name-quality` | 4 | 仓库名质量 | 仓库名是否具描述性、是否含占位词/乱码/纯缩写 |

**这是 RepoRadar 的差异点。** 多数"社区健康"工具不关心可发现性，而可发现性恰恰决定了项目会不会被看见。一个没人搜得到的项目，技术再好也是失败的。

## 🛠️ Engineering（权重 20）

> 衡量：CI、测试，以及让贡献安全合入的卫生状况。

| id | 权重 | 标题 | 检查逻辑 |
| :-- | --: | :-- | :-- |
| `ci-workflow` | 6 | 持续集成 | `.github/workflows` 下是否存在 CI 配置 |
| `tests` | 5 | 测试套件 | 是否存在测试目录/配置（如 `test/`、`__tests__`、`vitest` 等） |
| `gitignore` | 2 | .gitignore | 是否包含 `.gitignore` |
| `dependency-manifest` | 2 | 依赖清单与锁文件 | 是否有 `package.json` / `pyproject.toml` 等清单及锁文件 |
| `linter-config` | 3 | Linter / 格式化配置 | 是否有 ESLint / Prettier 等配置 |
| `editorconfig` | 2 | .editorconfig | 是否包含 `.editorconfig` 统一编辑器设置 |

## 🤝 Community（权重 15）

> 衡量：项目是否准备好接受别人的帮助？

| id | 权重 | 标题 | 检查逻辑 |
| :-- | --: | :-- | :-- |
| `issue-template` | 4 | Issue 模板 | 是否配置了 issue 模板 |
| `pr-template` | 3 | PR 模板 | 是否有 PR 模板 |
| `code-of-conduct` | 3 | 行为准则 | 是否包含行为准则 |
| `contributor-base` | 3 | 贡献者基数 | 贡献者数量是否达到一定规模 |
| `discussions-or-support` | 2 | 支持渠道 | 是否启用 Discussions 或有支持渠道 |

## 💓 Maintenance（权重 15）

> 衡量：它看起来还活着吗？提交、发布、待办、仓库状态。

| id | 权重 | 标题 | 检查逻辑 |
| :-- | --: | :-- | :-- |
| `recent-activity` | 5 | 近期提交活跃度 | 最近一次 push 距今是否在一个合理窗口内 |
| `release-cadence` | 4 | 发布节奏 | 是否有 Releases，且发布节奏不过于稀疏 |
| `issue-backlog` | 3 | Issue 待办健康度 | 未关闭 issue 比例 / 响应情况是否健康 |
| `active-status` | 3 | 仓库状态 | 仓库是否被 archived 或标记为废弃 |

## 等级对照

| 等级 | 最低分 | 标签 |
| :-- | --: | :-- |
| A+ | 93 | Exemplary 典范 |
| A  | 85 | Excellent 优秀 |
| B  | 75 | Solid 扎实 |
| C  | 60 | Needs work 需改进 |
| D  | 45 | Rough 粗糙 |
| F  | 0  | Not ready 未就绪 |
