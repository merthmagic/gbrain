# gbrain

一个基于 `Bun + TypeScript + SQLite` 的本地知识库 CLI，支持：

- 页面管理（Markdown + frontmatter）
- 标签和页面链接（backlinks）
- 时间线条目管理
- 全文检索（SQLite FTS5）
- 可选语义检索（Ollama embeddings）
- Markdown 目录导入导出
- MCP server（供 AI Agent 调用）

## 安装与运行

```bash
bun install
```

开发模式运行（推荐）：

```bash
bun run dev <command> [args...] [--flags]
```

也可以直接运行入口：

```bash
bun run src/cli.ts <command> [args...] [--flags]
```

## 数据库与全局参数

- 默认数据库路径：`./brain.db`
- 可通过 `--db <path>` 或环境变量 `GBRAIN_DB` 指定
- `--json` 可输出 JSON 结果（便于脚本处理）

## 页面格式

`put` / `import` 读取 Markdown，要求 frontmatter 至少包含：

- `type`：页面类型
- `title`：页面标题

支持的 `type`：

- `person`
- `company`
- `deal`
- `yc`
- `civic`
- `project`
- `concept`
- `source`
- `media`

示例：

```markdown
---
type: person
title: Alice Zhang
tags: [founder, ai]
---

Alice is building an applied AI startup.

---

2026-04-10 Joined YC.
```

说明：

- 第一个正文分隔线 `---` 之前是 `compiled_truth`
- 分隔线之后是 `timeline` 文本区（可选）

## 命令总览

### 页面

- `init [path]`：初始化数据库
- `get <slug>`：读取页面
- `put <slug>`：写入/更新页面（从 stdin 读取 Markdown）
- `list [--type <type>] [--tag <tag>] [--limit N] [--offset N]`：列出页面
- `stats`：查看统计信息

### 标签

- `tags <slug>`：查看页面标签
- `tag <slug> <tag>`：添加标签
- `untag <slug> <tag>`：移除标签

### 链接

- `link <from> <to> [--context "..."]`：创建页面链接
- `unlink <from> <to>`：删除页面链接
- `backlinks <slug>`：查看反向链接

### 时间线

- `timeline <slug> [--limit N]`：查看结构化时间线条目
- `timeline-add <slug> --date <YYYY-MM-DD> --summary "..." [--source "..."] [--detail "..."]`：新增时间线条目

### 检索

- `search <query> [--type <type>] [--limit N]`：FTS5 全文检索
- `query <question> [--limit N] [--semantic]`：查询（默认 FTS，可选语义检索）
- `embed <slug>` 或 `embed --all`：生成向量（默认 provider: Ollama）

### 数据迁移

- `import <directory>`：从 markdown 目录递归导入
- `export [--dir <path>]`：导出为 markdown 文件

### MCP / 集成

- `serve`：启动 MCP stdio server
- `call <tool> <json>`：直接调用 MCP 工具（本地调试/脚本化）
- `config [key] [value]`：查看或设置配置
- `version`：查看版本

## 快速开始

### 0) 使用内置最小演示数据集

仓库内置了可直接导入的数据集：`examples/minimal-notes`。

```bash
bun run dev init ./demo.db
bun run dev import ./examples/minimal-notes --db ./demo.db
bun run dev list --db ./demo.db
bun run dev backlinks people/alice --db ./demo.db
```

### 1) 初始化并创建两页数据

```bash
bun run dev init ./brain.db

cat <<'EOF' | bun run dev put people/alice --db ./brain.db
---
type: person
title: Alice Zhang
tags: [founder, ai]
---

Alice founded Acme AI in 2025.
EOF

cat <<'EOF' | bun run dev put companies/acme-ai --db ./brain.db
---
type: company
title: Acme AI
tags: [startup]
---

Acme AI builds copilots for operations teams.
EOF
```

### 2) 建立关系并查询

```bash
bun run dev link people/alice companies/acme-ai --context "Alice founded Acme AI" --db ./brain.db
bun run dev backlinks companies/acme-ai --db ./brain.db
bun run dev search "copilot operations" --db ./brain.db
```

### 3) 添加时间线事件

```bash
bun run dev timeline-add people/alice \
  --date 2026-04-12 \
  --summary "Spoke at AI Summit" \
  --source "event note" \
  --detail "Talked about AI adoption in enterprise." \
  --db ./brain.db

bun run dev timeline people/alice --db ./brain.db
```

### 4) 导入现有 Markdown 目录

```bash
bun run dev import ./notes --db ./brain.db
bun run dev stats --db ./brain.db
bun run dev export --dir ./exported-notes --db ./brain.db
```

### 5) 语义检索（Ollama）

先确保本地 Ollama 可用（默认 `http://localhost:11434`，模型如 `bge-m3`）。

```bash
bun run dev embed --all --provider ollama --model bge-m3 --db ./brain.db
bun run dev query "Who is connected to Acme AI?" --semantic --db ./brain.db
```

### 6) 使用 `call` 直接调用 MCP 工具

```bash
bun run dev call get_stats '{}' --db ./brain.db --json
bun run dev call list_pages '{"type":"company","limit":5}' --db ./brain.db --json
bun run dev call get_page '{"slug":"people/alice"}' --db ./brain.db
```

## 使用场景示例

### 场景 A：个人/团队关系图谱

目标：维护人、公司、项目之间的连接关系。

- 用 `put` 存实体页面
- 用 `link` 建关系
- 用 `backlinks` 快速看“谁关联到谁”
- 用 `search` / `query` 找相关上下文

### 场景 B：研究资料沉淀

目标：把分散的 markdown 资料导入并结构化检索。

- `import` 一次导入目录
- `tag` / `untag` 做主题分类
- `list --tag xxx` 按主题浏览
- `export` 导出给他人或归档

### 场景 C：事件追踪与复盘

目标：对关键对象维护可追溯时间线。

- 页面正文写当前结论（compiled truth）
- 用 `timeline-add` 持续追加事件证据
- 用 `timeline --limit N` 回看近期变化

### 场景 D：给 AI Agent 提供知识底座

目标：通过 MCP 把本地知识库接入 Agent。

- `serve` 启动 MCP server（stdio）
- Agent 调用 `get_page` / `search_pages` / `get_timeline` 等工具
- 或用 `call` 在本地快速调试工具行为

## 常见问题

- `put` 报 missing type/title：检查 frontmatter 是否包含 `type` 和 `title`
- `query --semantic` 失败：检查 Ollama 是否启动、模型是否可用
- `search` 无结果：先确认页面已写入，或尝试更宽泛关键词

## License

MIT
