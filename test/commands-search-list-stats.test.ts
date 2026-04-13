import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { BrainDB } from '../src/core/db';
import searchCmd from '../src/commands/search';
import queryCmd from '../src/commands/query';
import listCmd from '../src/commands/list';
import statsCmd from '../src/commands/stats';

function captureConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;
  console.log = (...a: any[]) => logs.push(a.join(' '));
  console.error = (...a: any[]) => errors.push(a.join(' '));
  console.warn = (...a: any[]) => errors.push(a.join(' '));
  return {
    logs,
    errors,
    restore: () => {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
    },
  };
}

let db: BrainDB;

beforeEach(() => {
  db = new BrainDB(':memory:');
  // Seed data for tests
  db.putPage('people/alice', {
    type: 'person',
    title: 'Alice Zhang',
    compiled_truth: 'Alice is a founder building AI startups.',
  });
  db.putPage('companies/acme-ai', {
    type: 'company',
    title: 'Acme AI',
    compiled_truth: 'Acme AI builds copilots for operations teams.',
  });
  db.putPage('people/bob', {
    type: 'person',
    title: 'Bob Smith',
    compiled_truth: 'Bob is an investor focused on enterprise software.',
  });
  db.putPage('concepts/machine-learning', {
    type: 'concept',
    title: 'Machine Learning',
    compiled_truth: 'Machine learning is a subset of AI focused on pattern recognition.',
  });
  // Add tags for list filtering
  db.addTag(db.getPage('people/alice')!.id, 'founder');
  db.addTag(db.getPage('people/bob')!.id, 'investor');
  db.addTag(db.getPage('companies/acme-ai')!.id, 'startup');
  // Add a link
  db.addLink('people/alice', 'companies/acme-ai');
  // Add timeline entry
  db.addTimelineEntry(db.getPage('people/alice')!.id, {
    date: '2024-01-15',
    source: 'test',
    summary: 'Founded Acme AI',
  });
});

afterEach(() => {
  db.close();
});

// ============================================================
// search command
// ============================================================
describe('search command', () => {
  test('searches and finds results', async () => {
    const capture = captureConsole();
    try {
      await searchCmd(['founder'], {}, db);
      expect(capture.logs.length).toBeGreaterThan(0);
      expect(capture.logs[0]).toContain('Search results for "founder"');
      expect(capture.logs.some(l => l.includes('people/alice'))).toBe(true);
    } finally {
      capture.restore();
    }
  });

  test('no results case', async () => {
    const capture = captureConsole();
    try {
      await searchCmd(['xyznonexistent123'], {}, db);
      expect(capture.logs[0]).toContain('Search results for "xyznonexistent123"');
      expect(capture.logs.some(l => l.includes('(no results)'))).toBe(true);
    } finally {
      capture.restore();
    }
  });

  test('--type flag filtering', async () => {
    const capture = captureConsole();
    try {
      await searchCmd(['AI'], { type: 'company' }, db);
      expect(capture.logs[0]).toContain('Search results for "AI"');
      // Only company results should appear
      const resultLines = capture.logs.filter(l => l.includes('(company)'));
      expect(resultLines.length).toBeGreaterThan(0);
      // No person results
      const personLines = capture.logs.filter(l => l.includes('(person)'));
      expect(personLines.length).toBe(0);
    } finally {
      capture.restore();
    }
  });

  test('--json output', async () => {
    const capture = captureConsole();
    try {
      await searchCmd(['Alice'], { json: 'true' }, db);
      const output = capture.logs.join('\n');
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('query', 'Alice');
      expect(parsed).toHaveProperty('results');
      expect(Array.isArray(parsed.results)).toBe(true);
      expect(parsed.results.length).toBeGreaterThan(0);
      expect(parsed.results[0]).toHaveProperty('slug');
      expect(parsed.results[0]).toHaveProperty('score');
    } finally {
      capture.restore();
    }
  });

  test('error on missing query', async () => {
    const origExit = process.exit;
    process.exit = (() => {
      throw new Error('process.exit(1)');
    }) as any;
    const capture = captureConsole();
    try {
      await searchCmd([], {}, db);
      expect(true).toBe(false); // should not reach here
    } catch (e: any) {
      expect(e.message).toBe('process.exit(1)');
      expect(capture.errors.some(l => l.includes('Missing query argument'))).toBe(true);
      expect(capture.errors.some(l => l.includes('Usage: gbrain search <query>'))).toBe(true);
    } finally {
      capture.restore();
      process.exit = origExit;
    }
  });
});

// ============================================================
// query command
// ============================================================
describe('query command', () => {
  test('default FTS5 search', async () => {
    const capture = captureConsole();
    try {
      await queryCmd(['founder'], {}, db);
      expect(capture.logs[0]).toContain('Query results for "founder"');
      expect(capture.logs[0]).toContain('FTS5');
      expect(capture.logs.some(l => l.includes('people/alice'))).toBe(true);
    } finally {
      capture.restore();
    }
  });

  test('error on missing question', async () => {
    const origExit = process.exit;
    process.exit = (() => {
      throw new Error('process.exit(1)');
    }) as any;
    const capture = captureConsole();
    try {
      await queryCmd([], {}, db);
      expect(true).toBe(false); // should not reach here
    } catch (e: any) {
      expect(e.message).toBe('process.exit(1)');
      expect(capture.errors.some(l => l.includes('Missing question argument'))).toBe(true);
      expect(capture.errors.some(l => l.includes('Usage: gbrain query <question>'))).toBe(true);
    } finally {
      capture.restore();
      process.exit = origExit;
    }
  });

  test('--json output', async () => {
    const capture = captureConsole();
    try {
      await queryCmd(['Alice'], { json: 'true' }, db);
      const output = capture.logs.join('\n');
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('question', 'Alice');
      expect(parsed).toHaveProperty('results');
      expect(parsed).toHaveProperty('search_type', 'fts');
      expect(Array.isArray(parsed.results)).toBe(true);
    } finally {
      capture.restore();
    }
  });

  test('falls back to FTS5 when semantic search fails', async () => {
    const capture = captureConsole();
    try {
      // Use a non-routable port to fail fast instead of waiting for Ollama timeout
      await queryCmd(['founder'], { semantic: 'true', url: 'http://127.0.0.1:1' }, db);
      // Should have logged the semantic error
      expect(capture.errors.some(l => l.includes('semantic search'))).toBe(true);
      expect(capture.errors.some(l => l.includes('Falling back to FTS5'))).toBe(true);
      // Should still produce results (labeled as semantic since useSemantic is true)
      expect(capture.logs[0]).toContain('Query results for "founder"');
      expect(capture.logs.some(l => l.includes('people/alice'))).toBe(true);
    } finally {
      capture.restore();
    }
  });
});

// ============================================================
// list command
// ============================================================
describe('list command', () => {
  test('lists all pages', async () => {
    const capture = captureConsole();
    try {
      await listCmd([], {}, db);
      expect(capture.logs[0]).toContain('Found 4 page(s)');
      expect(capture.logs.some(l => l.includes('people/alice'))).toBe(true);
      expect(capture.logs.some(l => l.includes('companies/acme-ai'))).toBe(true);
      expect(capture.logs.some(l => l.includes('people/bob'))).toBe(true);
      expect(capture.logs.some(l => l.includes('concepts/machine-learning'))).toBe(true);
    } finally {
      capture.restore();
    }
  });

  test('filter by --type', async () => {
    const capture = captureConsole();
    try {
      await listCmd([], { type: 'person' }, db);
      expect(capture.logs[0]).toContain('Found 2 page(s)');
      expect(capture.logs.some(l => l.includes('people/alice'))).toBe(true);
      expect(capture.logs.some(l => l.includes('people/bob'))).toBe(true);
      // Should not include company or concept
      expect(capture.logs.some(l => l.includes('companies/acme-ai'))).toBe(false);
      expect(capture.logs.some(l => l.includes('concepts/machine-learning'))).toBe(false);
    } finally {
      capture.restore();
    }
  });

  test('filter by --tag', async () => {
    const capture = captureConsole();
    try {
      await listCmd([], { tag: 'investor' }, db);
      expect(capture.logs[0]).toContain('Found 1 page(s)');
      expect(capture.logs.some(l => l.includes('people/bob'))).toBe(true);
      expect(capture.logs.some(l => l.includes('people/alice'))).toBe(false);
    } finally {
      capture.restore();
    }
  });

  test('pagination with --limit and --offset', async () => {
    const capture = captureConsole();
    try {
      // First page: limit 2
      await listCmd([], { limit: '2' }, db);
      expect(capture.logs[0]).toContain('Found 2 page(s)');
    } finally {
      capture.restore();
    }

    // Second page: limit 2, offset 2
    const capture2 = captureConsole();
    try {
      await listCmd([], { limit: '2', offset: '2' }, db);
      expect(capture2.logs[0]).toContain('Found 2 page(s)');
    } finally {
      capture2.restore();
    }
  });

  test('empty database output', async () => {
    const emptyDb = new BrainDB(':memory:');
    const capture = captureConsole();
    try {
      await listCmd([], {}, emptyDb);
      expect(capture.logs[0]).toBe('No pages found.');
    } finally {
      capture.restore();
      emptyDb.close();
    }
  });

  test('--json output', async () => {
    const capture = captureConsole();
    try {
      await listCmd([], { json: 'true' }, db);
      const output = capture.logs.join('\n');
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(4);
      expect(parsed[0]).toHaveProperty('slug');
      expect(parsed[0]).toHaveProperty('type');
      expect(parsed[0]).toHaveProperty('title');
    } finally {
      capture.restore();
    }
  });
});

// ============================================================
// stats command
// ============================================================
describe('stats command', () => {
  test('shows stats for populated database', async () => {
    const capture = captureConsole();
    try {
      await statsCmd([], {}, db);
      expect(capture.logs[0]).toBe('Brain Statistics:');
      expect(capture.logs.some(l => l.includes('Pages: 4'))).toBe(true);
      expect(capture.logs.some(l => l.includes('person: 2'))).toBe(true);
      expect(capture.logs.some(l => l.includes('company: 1'))).toBe(true);
      expect(capture.logs.some(l => l.includes('concept: 1'))).toBe(true);
      expect(capture.logs.some(l => l.includes('Links: 1'))).toBe(true);
      expect(capture.logs.some(l => l.includes('Tags: 3'))).toBe(true);
      expect(capture.logs.some(l => l.includes('Timeline Entries: 1'))).toBe(true);
      expect(capture.logs.some(l => l.includes('Database Size:'))).toBe(true);
    } finally {
      capture.restore();
    }
  });

  test('shows stats for empty database', async () => {
    const emptyDb = new BrainDB(':memory:');
    const capture = captureConsole();
    try {
      await statsCmd([], {}, emptyDb);
      expect(capture.logs[0]).toBe('Brain Statistics:');
      expect(capture.logs.some(l => l.includes('Pages: 0'))).toBe(true);
      expect(capture.logs.some(l => l.includes('Links: 0'))).toBe(true);
      expect(capture.logs.some(l => l.includes('Tags: 0'))).toBe(true);
      expect(capture.logs.some(l => l.includes('Timeline Entries: 0'))).toBe(true);
      expect(capture.logs.some(l => l.includes('Raw Data: 0'))).toBe(true);
      expect(capture.logs.some(l => l.includes('Embeddings: 0'))).toBe(true);
    } finally {
      capture.restore();
      emptyDb.close();
    }
  });

  test('--json output', async () => {
    const capture = captureConsole();
    try {
      await statsCmd([], { json: 'true' }, db);
      const output = capture.logs.join('\n');
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('pages');
      expect(parsed.pages).toHaveProperty('total', 4);
      expect(parsed.pages).toHaveProperty('by_type');
      expect(parsed.pages.by_type).toHaveProperty('person', 2);
      expect(parsed.pages.by_type).toHaveProperty('company', 1);
      expect(parsed.pages.by_type).toHaveProperty('concept', 1);
      expect(parsed).toHaveProperty('links', 1);
      expect(parsed).toHaveProperty('tags', 3);
      expect(parsed).toHaveProperty('timeline_entries', 1);
      expect(parsed).toHaveProperty('raw_data', 0);
      expect(parsed).toHaveProperty('embeddings', 0);
      expect(parsed).toHaveProperty('db_size_bytes');
    } finally {
      capture.restore();
    }
  });
});
