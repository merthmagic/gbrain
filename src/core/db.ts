import Database from 'bun:sqlite';
import type { Page, PageType, PutPageInput, TimelineEntry, BrainStats } from './types';

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- pages: 核心内容表
-- ============================================================
CREATE TABLE IF NOT EXISTS pages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT    NOT NULL UNIQUE,
  type            TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  compiled_truth  TEXT    NOT NULL DEFAULT '',
  timeline        TEXT    NOT NULL DEFAULT '',
  frontmatter     TEXT    NOT NULL DEFAULT '{}',
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_pages_type ON pages(type);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_updated ON pages(updated_at);

-- ============================================================
-- page_fts: 全文搜索（FTS5）
-- ============================================================
CREATE VIRTUAL TABLE IF NOT EXISTS page_fts USING fts5(
  title,
  compiled_truth,
  timeline,
  content='pages',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- FTS 同步触发器
CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO page_fts(rowid, title, compiled_truth, timeline)
  VALUES (new.id, new.title, new.compiled_truth, new.timeline);
END;

CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO page_fts(page_fts, rowid, title, compiled_truth, timeline)
  VALUES ('delete', old.id, old.title, old.compiled_truth, old.timeline);
END;

CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
  INSERT INTO page_fts(page_fts, rowid, title, compiled_truth, timeline)
  VALUES ('delete', old.id, old.title, old.compiled_truth, old.timeline);
  INSERT INTO page_fts(rowid, title, compiled_truth, timeline)
  VALUES (new.id, new.title, new.compiled_truth, new.timeline);
END;

-- ============================================================
-- page_embeddings: 向量嵌入（预留接口）
-- ============================================================
CREATE TABLE IF NOT EXISTS page_embeddings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id     INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text  TEXT    NOT NULL,
  embedding   BLOB    NOT NULL,
  model       TEXT    NOT NULL DEFAULT 'text-embedding-3-small',
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(page_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_page ON page_embeddings(page_id);

-- ============================================================
-- links: 页面间交叉引用
-- ============================================================
CREATE TABLE IF NOT EXISTS links (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  from_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  to_page_id   INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  context      TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(from_page_id, to_page_id)
);

CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_page_id);
CREATE INDEX IF NOT EXISTS idx_links_to   ON links(to_page_id);

-- ============================================================
-- tags
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag     TEXT    NOT NULL,
  UNIQUE(page_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tags_tag     ON tags(tag);
CREATE INDEX IF NOT EXISTS idx_tags_page_id ON tags(page_id);

-- ============================================================
-- raw_data: 附属数据
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_data (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  source     TEXT    NOT NULL,
  data       TEXT    NOT NULL,
  fetched_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(page_id, source)
);

CREATE INDEX IF NOT EXISTS idx_raw_data_page ON raw_data(page_id);

-- ============================================================
-- timeline_entries: 结构化时间线条目
-- ============================================================
CREATE TABLE IF NOT EXISTS timeline_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id    INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,
  source     TEXT    NOT NULL DEFAULT '',
  summary    TEXT    NOT NULL,
  detail     TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_timeline_page ON timeline_entries(page_id);
CREATE INDEX IF NOT EXISTS idx_timeline_date ON timeline_entries(date);

-- ============================================================
-- ingest_log: 摄入日志
-- ============================================================
CREATE TABLE IF NOT EXISTS ingest_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type    TEXT    NOT NULL,
  source_ref     TEXT    NOT NULL,
  pages_updated  TEXT    NOT NULL DEFAULT '[]',
  summary        TEXT    NOT NULL DEFAULT '',
  timestamp      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ============================================================
-- config: 全局配置
-- ============================================================
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO config (key, value) VALUES
  ('version', '1'),
  ('embedding_model', 'text-embedding-3-small'),
  ('embedding_dimensions', '1536'),
  ('chunk_strategy', 'section');
`;

export class BrainDB {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(SCHEMA_SQL);
  }

  // 页面 CRUD
  getPage(slug: string): Page | null {
    const row = this.db.query(
      'SELECT id, slug, type, title, compiled_truth, timeline, frontmatter, created_at, updated_at FROM pages WHERE slug = ?'
    ).get(slug) as Page | undefined;

    if (!row) return null;

    return {
      ...row,
      frontmatter: JSON.parse(row.frontmatter as unknown as string) as Record<string, unknown>,
    };
  }

  getPageById(id: number): Page | null {
    const row = this.db.query(
      'SELECT id, slug, type, title, compiled_truth, timeline, frontmatter, created_at, updated_at FROM pages WHERE id = ?'
    ).get(id) as Page | undefined;

    if (!row) return null;

    return {
      ...row,
      frontmatter: JSON.parse(row.frontmatter as unknown as string) as Record<string, unknown>,
    };
  }

  putPage(slug: string, data: PutPageInput): number {
    const existing = this.getPage(slug);
    const now = new Date().toISOString();

    if (existing) {
      // 更新：重写 compiled_truth，追加 timeline
      const newTimeline = existing.timeline + (data.timeline ? '\n\n' + data.timeline : '');
      this.db.query(
        `UPDATE pages 
         SET title = ?, type = ?, compiled_truth = ?, timeline = ?, 
             frontmatter = ?, updated_at = ? 
         WHERE slug = ?`
      ).run(
        data.title,
        data.type,
        data.compiled_truth || '',
        newTimeline,
        JSON.stringify(data.frontmatter || {}) as string,
        now,
        slug
      );
      return existing.id;
    } else {
      // 创建新页面
      const result = this.db.query(
        `INSERT INTO pages (slug, type, title, compiled_truth, timeline, frontmatter, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        slug,
        data.type,
        data.title,
        data.compiled_truth || '',
        data.timeline || '',
        JSON.stringify(data.frontmatter || {}) as string,
        now,
        now
      );
      return result.lastInsertRowid as number;
    }
  }

  deletePage(slug: string): boolean {
    const result = this.db.query('DELETE FROM pages WHERE slug = ?').run(slug);
    return result.changes > 0;
  }

  listPages(filter?: { type?: string; tag?: string; limit?: number; offset?: number }): Page[] {
    let sql = 'SELECT pages.id, pages.slug, pages.type, pages.title, pages.compiled_truth, pages.timeline, pages.frontmatter, pages.created_at, pages.updated_at FROM pages';
    const params: unknown[] = [];

    if (filter?.type || filter?.tag) {
      const conditions: string[] = [];
      if (filter.type) {
        conditions.push('type = ?');
        params.push(filter.type);
      }
      if (filter.tag) {
        sql += ' JOIN tags ON pages.id = tags.page_id';
        conditions.push('tags.tag = ?');
        params.push(filter.tag);
      }
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY updated_at DESC';

    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    if (filter?.offset) {
      sql += ' OFFSET ?';
      params.push(filter.offset);
    }

    const rows = this.db.query(sql).all(...(params as any)) as Page[];
    return rows.map(row => ({
      ...row,
      frontmatter: JSON.parse(row.frontmatter as unknown as string) as Record<string, unknown>,
    }));
  }

  // 标签
  getTags(slug: string): string[] {
    const page = this.getPage(slug);
    if (!page) return [];

    const rows = this.db.query('SELECT tag FROM tags WHERE page_id = ?').all(page.id) as { tag: string }[];
    return rows.map(r => r.tag);
  }

  addTag(pageId: number, tag: string): void {
    this.db.query('INSERT OR IGNORE INTO tags (page_id, tag) VALUES (?, ?)').run(pageId, tag);
  }

  removeTag(pageId: number, tag: string): void {
    this.db.query('DELETE FROM tags WHERE page_id = ? AND tag = ?').run(pageId, tag);
  }

  // 链接
  addLink(fromSlug: string, toSlug: string, context?: string): void {
    const fromPage = this.getPage(fromSlug);
    const toPage = this.getPage(toSlug);

    if (!fromPage || !toPage) {
      throw new Error('One or both pages not found');
    }

    this.db.query(
      'INSERT OR IGNORE INTO links (from_page_id, to_page_id, context) VALUES (?, ?, ?)'
    ).run(fromPage.id, toPage.id, context || '');
  }

  removeLink(fromSlug: string, toSlug: string): void {
    const fromPage = this.getPage(fromSlug);
    const toPage = this.getPage(toSlug);

    if (!fromPage || !toPage) return;

    this.db.query('DELETE FROM links WHERE from_page_id = ? AND to_page_id = ?').run(fromPage.id, toPage.id);
  }

  getBacklinks(slug: string): Page[] {
    const page = this.getPage(slug);
    if (!page) return [];

    const rows = this.db.query(
      `SELECT p.id, p.slug, p.type, p.title, p.compiled_truth, p.timeline, p.frontmatter, p.created_at, p.updated_at
       FROM pages p
       JOIN links l ON p.id = l.from_page_id
       WHERE l.to_page_id = ?`
    ).all(page.id) as Page[];

    return rows.map(row => ({
      ...row,
      frontmatter: JSON.parse(row.frontmatter as unknown as string) as Record<string, unknown>,
    }));
  }

  // 时间线
  getTimeline(slug: string, limit?: number): TimelineEntry[] {
    const page = this.getPage(slug);
    if (!page) return [];

    let sql = 'SELECT id, page_id, date, source, summary, detail, created_at FROM timeline_entries WHERE page_id = ? ORDER BY date DESC';
    const params: unknown[] = [page.id];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return this.db.query(sql).all(...(params as any)) as TimelineEntry[];
  }

  addTimelineEntry(pageId: number, entry: { date: string; source?: string; summary: string; detail?: string }): number {
    const result = this.db.query(
      `INSERT INTO timeline_entries (page_id, date, source, summary, detail)
       VALUES (?, ?, ?, ?, ?)`
    ).run(pageId, entry.date, entry.source || '', entry.summary, entry.detail || '');
    return result.lastInsertRowid as number;
  }

  // 原始数据
  getRawData(slug: string, source?: string): Record<string, unknown> {
    const page = this.getPage(slug);
    if (!page) return {};

    let sql = 'SELECT source, data FROM raw_data WHERE page_id = ?';
    const params: unknown[] = [page.id];

    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }

    const rows = this.db.query(sql).all(...(params as any)) as { source: string; data: string }[];
    const result: Record<string, unknown> = {};

    for (const row of rows) {
      result[row.source] = JSON.parse(row.data);
    }

    return result;
  }

  setRawData(pageId: number, source: string, data: unknown): void {
    this.db.query(
      `INSERT INTO raw_data (page_id, source, data) VALUES (?, ?, ?)
       ON CONFLICT(page_id, source) DO UPDATE SET data = excluded.data`
    ).run(pageId, source, JSON.stringify(data));
  }

  // 摄入日志
  addIngestLog(entry: { source_type: string; source_ref: string; pages_updated: string[]; summary?: string }): void {
    this.db.query(
      `INSERT INTO ingest_log (source_type, source_ref, pages_updated, summary)
       VALUES (?, ?, ?, ?)`
    ).run(entry.source_type, entry.source_ref, JSON.stringify(entry.pages_updated) as string, entry.summary || '');
  }

  // 配置
  getConfig(key: string): string | null {
    const row = this.db.query('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  getAllConfigs(): Record<string, string> {
    const rows = this.db.query('SELECT key, value FROM config').all() as { key: string; value: string }[];
    const configs: Record<string, string> = {};
    for (const row of rows) {
      configs[row.key] = row.value;
    }
    return configs;
  }

  setConfig(key: string, value: string): void {
    this.db.query(`INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);
  }

  // 统计
  getStats(): BrainStats {
    const pagesTotal = this.db.query('SELECT COUNT(*) as count FROM pages').get() as { count: number };
    const linksCount = this.db.query('SELECT COUNT(*) as count FROM links').get() as { count: number };
    const tagsCount = this.db.query('SELECT COUNT(*) as count FROM tags').get() as { count: number };
    const rawDataCount = this.db.query('SELECT COUNT(*) as count FROM raw_data').get() as { count: number };
    const timelineEntriesCount = this.db.query('SELECT COUNT(*) as count FROM timeline_entries').get() as { count: number };
    const embeddingsCount = this.db.query('SELECT COUNT(*) as count FROM page_embeddings').get() as { count: number };

    const pagesByTypeRows = this.db.query('SELECT type, COUNT(*) as count FROM pages GROUP BY type').all() as { type: string; count: number }[];
    const pagesByType: Record<string, number> = {};
    for (const row of pagesByTypeRows) {
      pagesByType[row.type] = row.count;
    }

    // 获取数据库文件大小
    const dbSize = this.db.query('PRAGMA page_count').get() as { page_count: number };
    const pageSize = this.db.query('PRAGMA page_size').get() as { page_size: number };
    const dbSizeBytes = (dbSize.page_count as number) * (pageSize.page_size as number);

    return {
      pages: {
        total: pagesTotal.count,
        by_type: pagesByType,
      },
      links: linksCount.count,
      tags: tagsCount.count,
      raw_data: rawDataCount.count,
      timeline_entries: timelineEntriesCount.count,
      embeddings: embeddingsCount.count,
      db_size_bytes: dbSizeBytes,
    };
  }

  // 事务支持
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // 暴露 Database 实例（用于 FTS 搜索）
  getDatabase(): Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
