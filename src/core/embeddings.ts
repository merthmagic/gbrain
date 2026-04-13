import Database from 'bun:sqlite';
import type { SearchResult, EmbeddingChunk, PageType } from './types';

// Embedding provider interface
export interface EmbeddingProvider {
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
  readonly dimensions: number;
  readonly model: string;
}

// Ollama implementation
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private baseUrl: string;
  private _model: string;
  private _dimensions: number;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'bge-m3', dimensions: number = 1024) {
    this.baseUrl = baseUrl;
    this._model = model;
    this._dimensions = dimensions;
  }

  async embed(text: string): Promise<Float32Array> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this._model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json() as { embedding: number[] };
    return new Float32Array(data.embedding);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const embeddings = await Promise.all(
      texts.map(text => this.embed(text))
    );
    return embeddings;
  }

  get dimensions(): number {
    return this._dimensions;
  }

  get model(): string {
    return this._model;
  }
}

// OpenAI implementation (placeholder - to be implemented later)
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(apiKey: string, model?: string, dimensions?: number) {
    // Placeholder constructor
    throw new Error('OpenAIEmbeddingProvider not yet implemented');
  }

  async embed(text: string): Promise<Float32Array> {
    throw new Error('Not implemented');
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    throw new Error('Not implemented');
  }

  get dimensions(): number {
    return 1536;
  }

  get model(): string {
    return 'text-embedding-3-small';
  }
}

// Chunking strategies
export type ChunkStrategy = 'page' | 'section' | 'paragraph';

export function chunkText(text: string, strategy: ChunkStrategy): string[] {
  switch (strategy) {
    case 'page':
      return [text];
    case 'section':
      // Split by ## headers
      const sections = text.split(/^##\s+/m);
      // Remove empty sections and trim
      return sections.filter(s => s.trim()).map(s => s.trim());
    case 'paragraph':
      // Split by empty lines
      const paragraphs = text.split(/\n\n+/);
      return paragraphs.filter(p => p.trim()).map(p => p.trim());
    default:
      return [text];
  }
}

// Cosine similarity calculation
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Semantic search
export async function searchSemantic(
  db: Database,
  query: string,
  provider: EmbeddingProvider,
  options?: { limit?: number; type?: string }
): Promise<SearchResult[]> {
  const limit = options?.limit || 20;
  
  // Generate embedding for query
  const queryEmbedding = await provider.embed(query);
  
  // Get all embeddings from database
  let sql = `
    SELECT e.page_id, e.chunk_index, e.embedding, p.slug, p.title, p.type
    FROM page_embeddings e
    JOIN pages p ON p.id = e.page_id
  `;
  const params: unknown[] = [];
  
  if (options?.type) {
    sql += ' WHERE p.type = ?';
    params.push(options.type);
  }
  
  const rows = db.query(sql).all(...(params as any)) as {
    page_id: number;
    chunk_index: number;
    embedding: string;
    slug: string;
    title: string;
    type: string;
  }[];
  
  // Calculate similarities and rank
  const results: Array<{ slug: string; title: string; type: string; score: number; chunk_index: number }> = [];
  
  for (const row of rows) {
    const embeddingData = JSON.parse(row.embedding) as number[];
    const embedding = new Float32Array(embeddingData);
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    
    results.push({
      slug: row.slug,
      title: row.title,
      type: row.type,
      score: similarity,
      chunk_index: row.chunk_index,
    });
  }
  
  // Sort by similarity (descending) and limit
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, limit).map(r => ({
    page_id: r.chunk_index,
    slug: r.slug,
    title: r.title,
    type: r.type as PageType,
    score: r.score,
    snippet: '',
  }));
}

// Embedding generation
export async function generateEmbeddings(
  db: Database,
  provider: EmbeddingProvider,
  slug?: string
): Promise<number> {
  let pages;
  if (slug) {
    const page = db.query('SELECT * FROM pages WHERE slug = ?').get(slug) as any;
    if (!page) return 0;
    pages = [page];
  } else {
    pages = db.query('SELECT * FROM pages').all() as any[];
  }
  
  let count = 0;
  
  for (const page of pages) {
    // Chunk the content
    const chunks = chunkText(page.compiled_truth, 'section');
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await provider.embed(chunk);
      
      // Store embedding
      db.query(
        `INSERT INTO page_embeddings (page_id, chunk_index, chunk_text, embedding)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(page_id, chunk_index) DO UPDATE SET chunk_text = excluded.chunk_text, embedding = excluded.embedding`
      ).run(
        page.id,
        i,
        chunk,
        JSON.stringify(Array.from(embedding))
      );
      
      count++;
    }
  }
  
  return count;
}
