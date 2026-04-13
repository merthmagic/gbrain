# GBrain 详细设计文档

## Context

基于 Garry Tan 的 GBrain.md 规范，设计并实现一个开源的个人知识库系统。核心理念是"编译知识图谱"：SQLite 单文件存储，FTS5 全文搜索 + 向量嵌入语义搜索，Thin CLI + Fat Skills 架构，MCP 协议原生支持。

**技术栈**: Bun + TypeScript + SQLite (bun:sqlite)
**向量搜索**: 预留接口，FTS5 优先实现，向量搜索后续补充
**文档范围**: 完整详细设计（架构、Schema、API、CLI、模块、数据流、实现步骤）

---

## 1. 项目结构

```
gbrain/
├── README.md
├── CLAUDE.md                  # Claude Code 指令
├── package.json
├── tsconfig.json
├── bun.lock
│
├── bin/
│   └── gbrain                 # 编译后的二进制（gitignored）
│
├── src/
│   ├── cli.ts                 # 入口：参数解析 + 命令分发
│   ├── commands/              # 每个命令一个文件
│   │   ├── get.ts             # 读取页面
│   │   ├── put.ts             # 写入/更新页面
│   │   ├── search.ts          # FTS5 全文搜索
│   │   ├── query.ts           # 混合搜索（FTS5 + 向量）
│   │   ├── ingest.ts          # 摄入源文档
│   │   ├── link.ts            # 创建/删除交叉引用
│   │   ├── tags.ts            # 标签管理
│   │   ├── timeline.ts        # 时间线管理
│   │   ├── list.ts            # 列出页面（带过滤）
│   │   ├── stats.ts           # 统计信息
│   │   ├── export.ts          # 导出为 markdown
│   │   ├── import.ts          # 从 markdown 目录导入
│   │   ├── embed.ts           # 生成/重新生成嵌入
│   │   ├── serve.ts           # MCP 服务器
│   │   ├── call.ts            # 原始工具调用
│   │   ├── init.ts            # 创建新 brain.db
│   │   ├── config.ts          # 配置管理
│   │   └── version.ts         # 版本信息
│   │
│   ├── core/                  # 核心库
│   │   ├── db.ts              # 数据库连接、Schema 初始化、WAL 模式
│   │   ├── fts.ts             # FTS5 搜索：searchFTS(query) → ranked results
│   │   ├── embeddings.ts      # 向量操作：embed(text), cosineSimilarity(a, b), searchSemantic(query)
│   │   ├── markdown.ts        # 解析 frontmatter，拆分 compiled_truth/timeline，渲染页面
│   │   ├── links.ts           # 提取链接、解析 slug
│   │   └── types.ts           # TypeScript 接口定义
│   │
│   └── mcp/
│       └── server.ts          # MCP stdio 服务器：工具定义 + 处理器
│
├── skills/                    # Fat Markdown 技能文件
│   ├── ingest/SKILL.md
│   ├── query/SKILL.md
│   ├── maintain/SKILL.md
│   ├── enrich/SKILL.md
│   └── briefing/SKILL.md
│
├── test/
│   ├── import.test.ts         # 回归测试：import → export → diff
│   ├── fts.test.ts            # FTS5 搜索测试
│   ├── embeddings.test.ts     # 向量搜索测试
│   ├── links.test.ts          # 链接提取 + 解析测试
│   └── fixtures/              # 测试用 markdown 文件
│       ├── person.md
│       ├── company.md
│       └── .raw/
│           └── person.json
│
└── schema.sql                 # 完整 SQLite DDL（参考用，嵌入在 db.ts 中）
```

---

## 2. 数据库 Schema 设计

### 2.1 核心概念：Compiled Truth + Timeline

```
Above the line (compiled_truth): 始终保持最新。有新信息时重写。是智能评估。
Below the line (timeline):       仅追加，永不重写。是证据基础。
```

### 2.2 完整 SQL Schema

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- pages: 核心内容表
-- ============================================================
CREATE TABLE pages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT    NOT NULL UNIQUE,          -- e.g. "people/pedro-franceschi"
  type            TEXT    NOT NULL,                 -- person, company, deal, yc, civic, project, concept, source, media
  title           TEXT    NOT NULL,
  compiled_truth  TEXT    NOT NULL DEFAULT '',      -- markdown, above the line
  timeline        TEXT    NOT NULL DEFAULT '',      -- markdown, below the line
  frontmatter     TEXT    NOT NULL DEFAULT '{}',    -- JSON blob (原始 YAML 转换)
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_pages_type ON pages(type);
CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_updated ON pages(updated_at);

-- ============================================================
-- page_fts: 全文搜索（FTS5）
-- ============================================================
CREATE VIRTUAL TABLE page_fts USING fts5(
  title,
  compiled_truth,
  timeline,
  content='pages',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- FTS 同步触发器
CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO page_fts(rowid, title, compiled_truth, timeline)
  VALUES (new.id, new.title, new.compiled_truth, new.timeline);
END;

CREATE TRIGGER pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO page_fts(page_fts, rowid, title, compiled_truth, timeline)
  VALUES ('delete', old.id, old.title, old.compiled_truth, old.timeline);
END;

CREATE TRIGGER pages_au AFTER UPDATE ON pages BEGIN
  INSERT INTO page_fts(page_fts, rowid, title, compiled_truth, timeline)
  VALUES ('delete', old.id, old.title, old.compiled_truth, old.timeline);
  INSERT INTO page_fts(rowid, title, compiled_truth, timeline)
  VALUES (new.id, new.title, new.compiled_truth, new.timeline);
END;

-- ============================================================
-- page_embeddings: 向量嵌入（预留接口）
-- ============================================================
CREATE TABLE page_embeddings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id     INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,           -- 0-based 页内块索引
  chunk_text  TEXT    NOT NULL,           -- 被嵌入的文本
  embedding   BLOB    NOT NULL,           -- float32 数组原始字节
  model       TEXT    NOT NULL DEFAULT 'text-embedding-3-small',
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_embeddings_page ON page_embeddings(page_id);

-- ============================================================
-- links: 页面间交叉引用
-- ============================================================
CREATE TABLE links (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  from_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  to_page_id   INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  context      TEXT    NOT NULL DEFAULT '',    -- 包含链接的句子
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(from_page_id, to_page_id)
);

CREATE INDEX idx_links_from ON links(from_page_id);
CREATE INDEX idx_links_to   ON links(to_page_id);

-- ============================================================
-- tags
-- ============================================================
CREATE TABLE tags (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag     TEXT    NOT NULL,
  UNIQUE(page_id, tag)
);

CREATE INDEX idx_tags_tag     ON tags(tag);
CREATE INDEX idx_tags_page_id ON tags(page_id);

-- ============================================================
-- raw_data: 附属数据（替代 .raw/ JSON 文件）
-- ============================================================
CREATE TABLE raw_data (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  source     TEXT    NOT NULL,        -- "crustdata", "happenstance", "exa", etc.
  data       TEXT    NOT NULL,        -- 完整 JSON 响应
  fetched_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(page_id, source)
);

CREATE INDEX idx_raw_data_page ON raw_data(page_id);

-- ============================================================
-- timeline_entries: 结构化时间线条目
-- ============================================================
CREATE TABLE timeline_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,        -- ISO 8601: YYYY-MM-DD
  source     TEXT    NOT NULL DEFAULT '',
  summary    TEXT    NOT NULL,
  detail     TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_timeline_page ON timeline_entries(page_id);
CREATE INDEX idx_timeline_date ON timeline_entries(date);

-- ============================================================
-- ingest_log: 摄入日志
-- ============================================================
CREATE TABLE ingest_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type    TEXT    NOT NULL,     -- "meeting", "article", "doc", "conversation", "import"
  source_ref     TEXT    NOT NULL,     -- meeting ID, URL, 文件路径等
  pages_updated  TEXT    NOT NULL DEFAULT '[]',   -- JSON 数组：page slugs
  summary        TEXT    NOT NULL DEFAULT '',
  timestamp      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ============================================================
-- config: 全局配置
-- ============================================================
CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO config (key, value) VALUES
  ('version', '1'),
  ('embedding_model', 'text-embedding-3-small'),
  ('embedding_dimensions', '1536'),
  ('chunk_strategy', 'section');
```

### 2.3 字段约定

| 约定 | 说明 |
|------|------|
| 文本编码 | 全部 UTF-8 |
| 时间格式 | ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ` 时间戳, `YYYY-MM-DD` 日期) |
| 嵌入存储 | Float32Array 原始字节 BLOB，1536 × 4 = 6,144 bytes/chunk |
| JSON 字段 | TEXT 存储，应用层解析 |
| Slug 格式 | 含目录前缀：`people/pedro-franceschi`, `companies/river-ai` |

---

## 3. 核心模块设计

### 3.1 TypeScript 接口定义 (`src/core/types.ts`)

```typescript
// 页面类型
export type PageType = 'person' | 'company' | 'deal' | 'yc' | 'civic'
  | 'project' | 'concept' | 'source' | 'media';

// 页面对象
export interface Page {
  id: number;
  slug: string;
  type: PageType;
  title: string;
  compiled_truth: string;
  timeline: string;
  frontmatter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// 搜索结果
export interface SearchResult {
  page_id: number;
  slug: string;
  title: string;
  type: PageType;
  score: number;
  snippet: string;
}

// 嵌入块
export interface EmbeddingChunk {
  id: number;
  page_id: number;
  chunk_index: number;
  chunk_text: string;
  embedding: Float32Array;
  model: string;
  created_at: string;
}

// 链接
export interface Link {
  id: number;
  from_page_id: number;
  to_page_id: number;
  context: string;
  created_at: string;
}

// 时间线条目
export interface TimelineEntry {
  id: number;
  page_id: number;
  date: string;
  source: string;
  summary: string;
  detail: string;
  created_at: string;
}

// 摄入日志
export interface IngestLog {
  id: number;
  source_type: string;
  source_ref: string;
  pages_updated: string[];
  summary: string;
  timestamp: string;
}

// 统计信息
export interface BrainStats {
  pages: { total: number; by_type: Record<string, number> };
  links: number;
  tags: number;
  raw_data: number;
  timeline_entries: number;
  embeddings: number;
  db_size_bytes: number;
}
```

### 3.2 数据库模块 (`src/core/db.ts`)

**职责**: 数据库连接管理、Schema 初始化、CRUD 操作

**关键设计点**:
- 使用 `bun:sqlite` 内置模块，无需额外依赖
- WAL 模式保证并发读性能
- 单例连接模式，进程内共享一个 DB 实例
- 数据库路径通过 `GBRAIN_DB` 环境变量或 `--db` 参数指定，默认 `./brain.db`

```typescript
// 核心接口
class BrainDB {
  private db: Database;

  constructor(dbPath: string);  // 打开/创建数据库，初始化 Schema

  // 页面 CRUD
  getPage(slug: string): Page | null;
  getPageById(id: number): Page | null;
  putPage(slug: string, data: PutPageInput): number;  // 返回 page_id
  deletePage(slug: string): boolean;
  listPages(filter?: { type?: string; tag?: string; limit?: number; offset?: number }): Page[];

  // 标签
  getTags(slug: string): string[];
  addTag(pageId: number, tag: string): void;
  removeTag(pageId: number, tag: string): void;

  // 链接
  addLink(fromSlug: string, toSlug: string, context?: string): void;
  removeLink(fromSlug: string, toSlug: string): void;
  getBacklinks(slug: string): Page[];

  // 时间线
  getTimeline(slug: string, limit?: number): TimelineEntry[];
  addTimelineEntry(pageId: number, entry: { date: string; source?: string; summary: string; detail?: string }): number;

  // 原始数据
  getRawData(slug: string, source?: string): Record<string, unknown>;
  setRawData(pageId: number, source: string, data: unknown): void;

  // 摄入日志
  addIngestLog(entry: { source_type: string; source_ref: string; pages_updated: string[]; summary?: string }): void;

  // 配置
  getConfig(key: string): string | null;
  setConfig(key: string, value: string): void;

  // 统计
  getStats(): BrainStats;

  // 事务支持
  transaction<T>(fn: () => T): T;
}
```

### 3.3 全文搜索模块 (`src/core/fts.ts`)

**职责**: FTS5 全文搜索

```typescript
// 核心接口
function searchFTS(db: Database, query: string, options?: {
  type?: string;      // 按页面类型过滤
  limit?: number;     // 默认 20
}): SearchResult[];

// BM25 排序 + snippet 提取
// 使用 page_fts 的 rank 和 snippet() 函数
// SQL 示例:
// SELECT p.id, p.slug, p.title, p.type,
//        rank as score,
//        snippet(page_fts, 2, '>>>', '<<<') as snippet
// FROM page_fts f
// JOIN pages p ON p.id = f.rowid
// WHERE page_fts MATCH ?
// ORDER BY rank
// LIMIT ?
```

### 3.4 向量嵌入模块 (`src/core/embeddings.ts`)

**职责**: 嵌入生成、存储、相似度计算（预留接口）

```typescript
// 核心接口
interface EmbeddingProvider {
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
  readonly dimensions: number;
  readonly model: string;
}

// OpenAI 实现（后续实现）
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(apiKey: string, model?: string, dimensions?: number);
  async embed(text: string): Promise<Float32Array>;
  async embedBatch(texts: string[]): Promise<Float32Array[]>;
  readonly dimensions: number;
  readonly model: string;
}

// 分块策略
function chunkText(text: string, strategy: 'page' | 'section' | 'paragraph'): string[];
// section: 按 ## 标题拆分
// paragraph: 按空行拆分
// page: 整页作为一个块

// 相似度计算
function cosineSimilarity(a: Float32Array, b: Float32Array): number;

// 语义搜索
async function searchSemantic(
  db: Database,
  query: string,
  provider: EmbeddingProvider,
  options?: { limit?: number; type?: string }
): Promise<SearchResult[]>;

// 嵌入管理
async function generateEmbeddings(
  db: Database,
  provider: EmbeddingProvider,
  slug?: string  // 不传则处理所有页面
): Promise<number>;  // 返回处理的块数
```

### 3.5 Markdown 解析模块 (`src/core/markdown.ts`)

**职责**: Frontmatter 解析、content 拆分、页面渲染

```typescript
// 解析 markdown 文件
interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  compiledTruth: string;
  timeline: string;
}

function parseMarkdown(content: string): ParsedMarkdown;
// 1. 提取 YAML frontmatter（---之间）
// 2. 拆分 body：第一个 --- 水平线之前 = compiled_truth，之后 = timeline

// 渲染页面为完整 markdown
function renderPage(page: Page): string;
// 1. frontmatter → YAML
// 2. compiled_truth + timeline（中间加 --- 分隔）
// 3. 组合为完整 markdown 文件
```

### 3.6 链接提取模块 (`src/core/links.ts`)

**职责**: 从 markdown 中提取 wiki 链接，解析 slug

```typescript
interface ExtractedLink {
  displayText: string;
  targetSlug: string;
  context: string;    // 周围的句子
}

function extractLinks(markdown: string): ExtractedLink[];
// 匹配模式: [Display Text](../people/name.md)
// 转换为 slug: "people/name"

function resolveSlug(slug: string): string;
// 标准化 slug，处理 .md 后缀、相对路径等
```

---

## 4. CLI 命令设计

### 4.1 命令分发 (`src/cli.ts`)

```typescript
// cli.ts 使用简单的参数解析
// 模式: gbrain <command> [args...] [--flags]

const commands: Record<string, (args: string[], flags: Record<string, string>) => Promise<void>> = {
  'get':          getCommand,
  'put':          putCommand,
  'search':       searchCommand,
  'query':        queryCommand,
  'ingest':       ingestCommand,
  'link':         linkCommand,
  'unlink':       unlinkCommand,
  'tags':         tagsCommand,
  'tag':          tagCommand,
  'untag':        untagCommand,
  'timeline':     timelineCommand,
  'timeline-add': timelineAddCommand,
  'backlinks':    backlinksCommand,
  'list':         listCommand,
  'stats':        statsCommand,
  'export':       exportCommand,
  'import':       importCommand,
  'embed':        embedCommand,
  'serve':        serveCommand,
  'call':         callCommand,
  'init':         initCommand,
  'config':       configCommand,
  'version':      versionCommand,
};
```

### 4.2 全局参数

| 参数 | 说明 |
|------|------|
| `--db <path>` | 指定 brain.db 路径 |
| `--json` | JSON 输出 |
| `GBRAIN_DB` | 环境变量指定数据库路径 |

### 4.3 各命令详细设计

#### `gbrain init [path]`
- 创建新的 brain.db，初始化所有表和索引
- 默认路径 `./brain.db`

#### `gbrain get <slug>`
- 按 slug 读取页面，输出完整 markdown（frontmatter + compiled_truth + timeline）

#### `gbrain put <slug> [< file.md]`
- 从 stdin 或文件读取 markdown 内容
- 解析 frontmatter，拆分 compiled_truth / timeline
- 如果 slug 已存在 → 更新（重写 compiled_truth，追加 timeline）
- 如果不存在 → 创建新页面

#### `gbrain search <query> [--type <type>] [--limit N]`
- 调用 FTS5 搜索
- 输出匹配的页面列表，包含 slug、分数、snippet

#### `gbrain query <question> [--limit N]`
- 混合搜索：FTS5 + 向量（如果嵌入可用）
- 合并去重，按综合分数排序
- 输出排名结果

#### `gbrain ingest <file> [--type meeting|article|doc|conversation]`
- 读取源文档
- 实体识别 → 更新/创建页面 → 建立链接 → 添加时间线条目 → 记录摄入日志
- **注意**: ingest 的"智能"在 Skill 层，CLI 层只负责调用和记录

#### `gbrain link <from-slug> <to-slug> [--context "..."]`
- 在 links 表中创建双向引用

#### `gbrain unlink <from-slug> <to-slug>`
- 删除链接

#### `gbrain tags <slug>` / `gbrain tag <slug> <tag>` / `gbrain untag <slug> <tag>`
- 标签 CRUD

#### `gbrain timeline <slug>` / `gbrain timeline-add <slug> --date ... --summary "..." [--source "..."] [--detail "..."]`
- 时间线查询和添加

#### `gbrain backlinks <slug>`
- 查询所有链接到指定 slug 的页面

#### `gbrain list [--type <type>] [--tag <tag>] [--limit N]`
- 列出页面，支持按类型和标签过滤

#### `gbrain stats`
- 输出统计信息：页面数（按类型）、链接数、标签数、嵌入数、DB 大小

#### `gbrain export [--dir ./export/]`
- 将所有页面导出为 markdown 文件
- 重构原始目录结构
- 重构 .raw/ 附属文件
- 验证与原始文件的 diff

#### `gbrain import <dir>`
- 从 markdown 目录导入（详见第 6 节迁移计划）

#### `gbrain embed [<slug>|--all|--stale]`
- 生成/重新生成嵌入向量
- `--stale`: 只处理 updated_at > last embedding 的页面

#### `gbrain serve`
- 启动 MCP stdio 服务器

#### `gbrain call <tool> '<json>'`
- 原始工具调用，JSON 输入输出

#### `gbrain --tools-json`
- 输出工具发现 JSON（兼容 Claude Code）

#### `gbrain pipe`
- JSONL 流式模式

---

## 5. MCP 服务器设计

### 5.1 配置

```json
{
  "mcpServers": {
    "gbrain": {
      "command": "gbrain",
      "args": ["serve", "--db", "/path/to/brain.db"]
    }
  }
}
```

### 5.2 暴露的工具

| Tool | 描述 | 参数 |
|------|------|------|
| `brain_search` | FTS5 全文搜索 | `{ query: string, type?: string, limit?: number }` |
| `brain_query` | 混合搜索（FTS5 + 向量） | `{ question: string, limit?: number }` |
| `brain_get` | 按 slug 读取页面 | `{ slug: string }` |
| `brain_put` | 写入/更新页面 | `{ slug: string, content: string }` 或 `{ slug: string, compiled_truth?: string, timeline_append?: string, frontmatter?: object }` |
| `brain_ingest` | 摄入源文档 | `{ content: string, source_type: string, source_ref: string }` |
| `brain_link` | 创建交叉引用 | `{ from: string, to: string, context?: string }` |
| `brain_timeline` | 获取时间线条目 | `{ slug: string, limit?: number }` |
| `brain_timeline_add` | 添加时间线条目 | `{ slug: string, date: string, summary: string, source?: string, detail?: string }` |
| `brain_tags` | 列出页面标签 | `{ slug: string }` |
| `brain_tag` | 添加/移除标签 | `{ slug: string, tag: string, remove?: boolean }` |
| `brain_list` | 列出页面 | `{ type?: string, tag?: string, limit?: number }` |
| `brain_backlinks` | 反向链接查询 | `{ slug: string }` |
| `brain_stats` | 统计信息 | `{}` |
| `brain_raw` | 读写原始数据 | `{ slug: string, source?: string, data?: object }` |

### 5.3 暴露的资源

| Resource | URI 模式 | 描述 |
|----------|----------|------|
| Page | `brain://pages/{slug}` | 完整页面内容（markdown） |
| Index | `brain://index` | 所有页面 slug（按类型分组） |

### 5.4 暴露的 Prompt

| Prompt | 描述 |
|--------|------|
| `brain_briefing` | 编译当前状态的每日简报 |
| `brain_ingest_meeting` | 摄入会议记录的指南 |

---

## 6. 导入/导出设计（迁移）

### 6.1 导入流程 (`gbrain import <dir>`)

```
Step 1: 扫描目录
  - 递归查找所有 .md 文件
  - 排除 schema.md, index.md, log.md, README.md
  - 目录 → 类型映射：
    people/ → person, companies/ → company, deals/ → deal,
    yc/ → yc, civic/ → civic, projects/ → project,
    concepts/ → concept, sources/ → source, media/ → media,
    meetings/ → source, programs/ → source

Step 2: 解析每个文件
  - 提取 YAML frontmatter
  - 拆分 compiled_truth / timeline（第一个 --- 水平线）
  - 提取 slug（文件路径 → slug）

Step 3: 提取链接
  - 正则匹配 wiki 链接: [Display](../people/name.md)
  - 记录 from_slug, to_slug, 周围句子作为 context

Step 4: 解析时间线条目
  - 匹配: - **YYYY-MM-DD** | Source — Summary. Detail.
  - 存入 timeline_entries 表

Step 5: 加载 .raw/ 附属文件
  - people/.raw/pedro-franceschi.json → raw_data 表
  - 每个 source key → 独立一行

Step 6: 提取标签
  - frontmatter.tags 数组 → tags 表

Step 7: 事务写入 SQLite
  - BEGIN TRANSACTION
  - 插入所有 pages → 获取 IDs
  - 插入 tags, links, timeline_entries, raw_data
  - COMMIT

Step 8: 生成嵌入（如果可用）
  - 按 section 策略分块
  - 调用嵌入 API → 存储 page_embeddings

Step 9: 验证
  - DB 页面数 == 文件数
  - 链接数 == 解析的 wiki 链接数
  - 随机抽查 10 个页面：export → diff

Step 10: 特殊文件处理
  - index.md → config('original_index')
  - log.md → ingest_log
  - schema.md → config('original_schema')
```

### 6.2 导出流程 (`gbrain export [--dir ./export/]`)

```
Step 1: 查询所有页面

Step 2: 重建每个页面
  - frontmatter JSON → YAML
  - compiled_truth + "\n\n---\n\n" + timeline
  - 组合为完整 markdown 文件

Step 3: 写入文件
  - <export-dir>/<slug>.md

Step 4: 重建 .raw/ 附属文件
  - 从 raw_data 表读取 → 写入 <dir>/.raw/<name>.json

Step 5: 生成 index.md

Step 6: 验证（如与原始目录对比）
```

---

## 7. 数据流设计

### 7.1 摄入数据流 (Ingest)

```
源文档（会议记录、文章、文档）
    │
    ▼
gbrain ingest（或 brain_ingest MCP 工具）
    │
    ├─→ 解析实体、决策、关系
    │
    ├─→ 对每个实体：
    │     ├─ gbrain get <slug> → 存在？更新 compiled_truth
    │     └─ 不存在？→ gbrain put <slug>（创建）
    │
    ├─→ gbrain link（交叉引用）
    │
    ├─→ gbrain timeline-add（结构化时间线条目）
    │
    ├─→ gbrain embed <slug>（更新向量，如果可用）
    │
    └─→ ingest_log 自动记录
```

### 7.2 查询数据流 (Query)

```
"谁认识 Jensen Huang？"
    │
    ▼
gbrain query
    │
    ├─→ FTS5: 搜索 "Jensen Huang" → 排名页面列表
    │
    ├─→ Vector: 嵌入问题 → 余弦相似度 → 排名块（如果可用）
    │
    ├─→ 合并 + 去重 + 重排
    │       公式: FTS5 分数 × 0.4 + 向量相似度 × 0.6
    │       类型匹配加成 +0.2
    │       30天内更新加成 +0.1
    │
    ├─→ 对 Top N 结果: gbrain get <slug> → 完整页面内容
    │
    └─→ 返回：排名页面 + 相关摘录
```

---

## 8. Skills 设计

Skills 是 Fat Markdown 文件，Claude Code 在会话开始时读取并遵循。**智能在 Skill 中，不在代码中。**

### 8.1 ingest/SKILL.md — 摄入技能
- 工作流：读源 → 识别实体 → 更新/创建页面 → 建链接 → 解析时间线 → 记录日志
- 入场标准：不是所有实体都值得建页面
- 质量规则：executive summary 更新、State 重写（非追加）、Timeline 仅追加

### 8.2 query/SKILL.md — 查询技能
- 三层搜索策略：FTS5 关键词 + 向量语义 + 结构化查询
- 排序启发式：FTS5×0.4 + 向量×0.6
- 不知道就说不知道，建议补充数据源

### 8.3 maintain/SKILL.md — 维护技能
- 8 项检查：矛盾检测、信息陈旧、孤立页面、缺失引用、死链、开放线程审计、标签一致性、嵌入新鲜度
- 输出维护报告页面

### 8.4 enrich/SKILL.md — 丰富技能
- 外部数据源：Crustdata、Happenstance、Exa、Captain/Pitchbook
- 人/公司丰富工作流
- 批量规则：检查点、退避、dry-run

### 8.5 briefing/SKILL.md — 简报技能
- 日历、活跃交易、开放线程、近期变更、关注人物、陈旧提醒

---

## 9. 实现步骤

### Phase 1: 基础设施 (核心模块)
1. 初始化项目：package.json, tsconfig.json, bun setup
2. 实现 `src/core/types.ts` — 所有接口定义
3. 实现 `src/core/db.ts` — 数据库连接 + Schema 初始化 + CRUD
4. 实现 `src/core/markdown.ts` — frontmatter 解析 + 内容拆分
5. 实现 `src/core/links.ts` — 链接提取 + 解析

### Phase 2: 基础命令
6. 实现 `src/cli.ts` — 参数解析 + 命令分发
7. 实现 `src/commands/init.ts` — 创建新 brain
8. 实现 `src/commands/get.ts` + `put.ts` — 读写页面
9. 实现 `src/commands/list.ts` + `stats.ts` — 列表 + 统计
10. 实现 `src/commands/tags.ts` — 标签管理
11. 实现 `src/commands/link.ts` — 链接管理
12. 实现 `src/commands/timeline.ts` — 时间线管理

### Phase 3: 搜索
13. 实现 `src/core/fts.ts` — FTS5 全文搜索
14. 实现 `src/commands/search.ts` — 搜索命令
15. 实现 `src/core/embeddings.ts` — 预留接口（接口定义 + 空实现）
16. 实现 `src/commands/query.ts` — 混合搜索（当前仅 FTS5）

### Phase 4: 导入导出
17. 实现 `src/commands/import.ts` — 从 markdown 目录导入
18. 实现 `src/commands/export.ts` — 导出为 markdown
19. 编写 `test/import.test.ts` — 回归测试（import → export → diff）

### Phase 5: MCP 服务器
20. 实现 `src/mcp/server.ts` — MCP stdio 服务器
21. 实现 `src/commands/serve.ts` + `call.ts` — serve + call 命令
22. 注册所有工具、资源、Prompt

### Phase 6: Skills + 测试
23. 编写 5 个 SKILL.md 文件
24. 编写 CLAUDE.md
25. 完善 `test/` 目录下所有测试
26. 编译二进制: `bun build --compile --outfile bin/gbrain src/cli.ts`

---

## 10. 依赖管理

```json
{
  "name": "gbrain",
  "version": "0.1.0",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "gray-matter": "^4.0.3",
    "yaml": "^2.4.0"
  },
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

- **bun:sqlite**: Bun 内置，无需额外安装
- **gray-matter**: frontmatter 解析
- **yaml**: YAML 序列化/反序列化
- **@modelcontextprotocol/sdk**: MCP 协议支持
- 链接提取使用正则（原文方案，更快更简单）

---

## 11. 验证方案

### 单元测试
```bash
bun test
```
- `test/fts.test.ts` — FTS5 搜索正确性
- `test/links.test.ts` — 链接提取和解析
- `test/embeddings.test.ts` — 嵌入接口（mock）
- `test/import.test.ts` — 回归测试：import → export → diff 原始文件

### 集成测试
```bash
# 创建新 brain
gbrain init /tmp/test-brain.db

# 写入测试页面
echo "---\ntitle: Test\ntype: person\n---\n# Test\n> Summary" | gbrain --db /tmp/test-brain.db put people/test

# 读取
gbrain --db /tmp/test-brain.db get people/test

# 搜索
gbrain --db /tmp/test-brain.db search "Test"

# 标签
gbrain --db /tmp/test-brain.db tag people/test yc-alum

# 统计
gbrain --db /tmp/test-brain.db stats

# 导出
gbrain --db /tmp/test-brain.db export --dir /tmp/test-export/

# MCP 工具调用
gbrain --db /tmp/test-brain.db call brain_stats '{}'
```

### 回归测试
- 导入 test/fixtures/ 目录
- 导出后与原始文件 diff
- 页面数、链接数、标签数必须完全一致
