import Database from 'bun:sqlite';
import type { SearchResult } from './types';

export function searchFTS(db: Database, query: string, options?: {
  type?: string;
  limit?: number;
}): SearchResult[] {
  const limit = options?.limit || 20;
  let sql = `
    SELECT p.id as page_id, p.slug, p.title, p.type,
           rank as score,
           p.compiled_truth as snippet
    FROM page_fts f
    JOIN pages p ON p.id = f.rowid
    WHERE page_fts MATCH ?
  `;
  const params: unknown[] = [query];

  if (options?.type) {
    sql += ' AND p.type = ?';
    params.push(options.type);
  }

  sql += ' ORDER BY rank LIMIT ?';
  params.push(limit);

  const rows = db.query(sql).all(...(params as any)) as SearchResult[];
  return rows;
}
