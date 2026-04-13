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

// Put 页面输入
export interface PutPageInput {
  type: PageType;
  title: string;
  compiled_truth?: string;
  timeline?: string;
  frontmatter?: Record<string, unknown>;
}
