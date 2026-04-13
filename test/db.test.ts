import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { BrainDB } from '../src/core/db';

let db: BrainDB;

beforeEach(() => {
  db = new BrainDB(':memory:');
});

afterEach(() => {
  db.close();
});

describe('Page CRUD', () => {
  test('create and read a page', () => {
    db.putPage('people/alice', {
      type: 'person',
      title: 'Alice Zhang',
      compiled_truth: 'Founder of Acme AI.',
    });

    const page = db.getPage('people/alice');
    expect(page).not.toBeNull();
    expect(page!.title).toBe('Alice Zhang');
    expect(page!.type).toBe('person');
    expect(page!.compiled_truth).toBe('Founder of Acme AI.');
    expect(page!.timeline).toBe('');
    expect(page!.slug).toBe('people/alice');
    expect(page!.id).toBeGreaterThan(0);
  });

  test('update existing page rewrites compiled_truth', () => {
    db.putPage('people/alice', {
      type: 'person',
      title: 'Alice',
      compiled_truth: 'Original content.',
    });

    db.putPage('people/alice', {
      type: 'person',
      title: 'Alice Zhang',
      compiled_truth: 'Updated content.',
    });

    const page = db.getPage('people/alice');
    expect(page!.title).toBe('Alice Zhang');
    expect(page!.compiled_truth).toBe('Updated content.');
  });

  test('update appends timeline', () => {
    db.putPage('people/alice', {
      type: 'person',
      title: 'Alice',
      compiled_truth: 'Content.',
      timeline: '2026-01-01 First event.',
    });

    db.putPage('people/alice', {
      type: 'person',
      title: 'Alice',
      compiled_truth: 'Updated.',
      timeline: '2026-02-01 Second event.',
    });

    const page = db.getPage('people/alice');
    expect(page!.timeline).toContain('2026-01-01 First event.');
    expect(page!.timeline).toContain('2026-02-01 Second event.');
  });

  test('get non-existent page returns null', () => {
    expect(db.getPage('non/existent')).toBeNull();
  });

  test('delete page', () => {
    db.putPage('test/page', { type: 'note', title: 'Test' });
    expect(db.getPage('test/page')).not.toBeNull();

    const deleted = db.deletePage('test/page');
    expect(deleted).toBe(true);
    expect(db.getPage('test/page')).toBeNull();
  });

  test('delete non-existent page returns false', () => {
    expect(db.deletePage('non/existent')).toBe(false);
  });

  test('getPageById', () => {
    db.putPage('test/page', { type: 'note', title: 'Test' });
    const page = db.getPage('test/page');
    const byId = db.getPageById(page!.id);

    expect(byId).not.toBeNull();
    expect(byId!.slug).toBe('test/page');
  });

  test('frontmatter is stored and parsed', () => {
    db.putPage('people/alice', {
      type: 'person',
      title: 'Alice',
      frontmatter: { tags: ['founder', 'ai'], role: 'CEO' },
    });

    const page = db.getPage('people/alice');
    expect(page!.frontmatter.tags).toEqual(['founder', 'ai']);
    expect(page!.frontmatter.role).toBe('CEO');
  });
});

describe('listPages', () => {
  test('lists all pages', () => {
    db.putPage('a', { type: 'person', title: 'A' });
    db.putPage('b', { type: 'company', title: 'B' });
    db.putPage('c', { type: 'person', title: 'C' });

    const pages = db.listPages();
    expect(pages).toHaveLength(3);
  });

  test('filter by type', () => {
    db.putPage('a', { type: 'person', title: 'A' });
    db.putPage('b', { type: 'company', title: 'B' });

    const pages = db.listPages({ type: 'person' });
    expect(pages).toHaveLength(1);
    expect(pages[0].type).toBe('person');
  });

  test('filter by tag', () => {
    const id = db.putPage('a', { type: 'person', title: 'A' });
    db.addTag(id, 'founder');

    const pages = db.listPages({ tag: 'founder' });
    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe('a');
  });

  test('pagination with limit and offset', () => {
    db.putPage('a', { type: 'note', title: 'A' });
    db.putPage('b', { type: 'note', title: 'B' });
    db.putPage('c', { type: 'note', title: 'C' });

    const page1 = db.listPages({ limit: 2 });
    expect(page1).toHaveLength(2);

    const page2 = db.listPages({ limit: 2, offset: 2 });
    expect(page2).toHaveLength(1);
  });

  test('empty list', () => {
    const pages = db.listPages();
    expect(pages).toHaveLength(0);
  });
});

describe('Tags', () => {
  test('add and get tags', () => {
    const id = db.putPage('test/page', { type: 'note', title: 'Test' });
    db.addTag(id, 'ai');
    db.addTag(id, 'founder');

    const tags = db.getTags('test/page');
    expect(tags).toEqual(['ai', 'founder']);
  });

  test('remove tag', () => {
    const id = db.putPage('test/page', { type: 'note', title: 'Test' });
    db.addTag(id, 'ai');
    db.addTag(id, 'founder');

    db.removeTag(id, 'ai');
    const tags = db.getTags('test/page');
    expect(tags).toEqual(['founder']);
  });

  test('duplicate tag is ignored', () => {
    const id = db.putPage('test/page', { type: 'note', title: 'Test' });
    db.addTag(id, 'ai');
    db.addTag(id, 'ai');

    const tags = db.getTags('test/page');
    expect(tags).toEqual(['ai']);
  });

  test('tags of non-existent page returns empty', () => {
    expect(db.getTags('non/existent')).toEqual([]);
  });

  test('cascading delete removes tags', () => {
    const id = db.putPage('test/page', { type: 'note', title: 'Test' });
    db.addTag(id, 'ai');
    db.deletePage('test/page');

    // Re-create with same slug
    const newId = db.putPage('test/page', { type: 'note', title: 'Test2' });
    const tags = db.getTags('test/page');
    expect(tags).toEqual([]);
  });
});

describe('Links', () => {
  test('create and get backlinks', () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });

    db.addLink('people/alice', 'companies/acme', 'Alice founded Acme');

    const backlinks = db.getBacklinks('companies/acme');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].slug).toBe('people/alice');
  });

  test('link with non-existent page throws', () => {
    db.putPage('a', { type: 'note', title: 'A' });
    expect(() => db.addLink('a', 'nonexistent', 'ctx')).toThrow('One or both pages not found');
  });

  test('duplicate link is ignored', () => {
    db.putPage('a', { type: 'note', title: 'A' });
    db.putPage('b', { type: 'note', title: 'B' });

    db.addLink('a', 'b', 'ctx');
    db.addLink('a', 'b', 'ctx2');

    const backlinks = db.getBacklinks('b');
    expect(backlinks).toHaveLength(1);
  });

  test('remove link', () => {
    db.putPage('a', { type: 'note', title: 'A' });
    db.putPage('b', { type: 'note', title: 'B' });

    db.addLink('a', 'b', 'ctx');
    db.removeLink('a', 'b');

    const backlinks = db.getBacklinks('b');
    expect(backlinks).toHaveLength(0);
  });

  test('backlinks of non-existent page returns empty', () => {
    expect(db.getBacklinks('non/existent')).toEqual([]);
  });
});

describe('Timeline', () => {
  test('add and get timeline entries', () => {
    const id = db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.addTimelineEntry(id, {
      date: '2026-04-10',
      source: 'meeting',
      summary: 'Joined YC',
      detail: 'S24 batch',
    });

    const entries = db.getTimeline('people/alice');
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-04-10');
    expect(entries[0].summary).toBe('Joined YC');
    expect(entries[0].source).toBe('meeting');
    expect(entries[0].detail).toBe('S24 batch');
  });

  test('timeline with limit', () => {
    const id = db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.addTimelineEntry(id, { date: '2026-01-01', summary: 'First' });
    db.addTimelineEntry(id, { date: '2026-02-01', summary: 'Second' });
    db.addTimelineEntry(id, { date: '2026-03-01', summary: 'Third' });

    const entries = db.getTimeline('people/alice', 2);
    expect(entries).toHaveLength(2);
  });

  test('timeline of non-existent page returns empty', () => {
    expect(db.getTimeline('non/existent')).toEqual([]);
  });

  test('timeline entries ordered by date DESC', () => {
    const id = db.putPage('test/page', { type: 'note', title: 'Test' });
    db.addTimelineEntry(id, { date: '2026-01-01', summary: 'First' });
    db.addTimelineEntry(id, { date: '2026-03-01', summary: 'Third' });
    db.addTimelineEntry(id, { date: '2026-02-01', summary: 'Second' });

    const entries = db.getTimeline('test/page');
    expect(entries[0].date).toBe('2026-03-01');
    expect(entries[1].date).toBe('2026-02-01');
    expect(entries[2].date).toBe('2026-01-01');
  });
});

describe('Config', () => {
  test('default config values are set', () => {
    expect(db.getConfig('version')).toBe('1');
    expect(db.getConfig('embedding_model')).toBe('text-embedding-3-small');
    expect(db.getConfig('chunk_strategy')).toBe('section');
  });

  test('set and get config', () => {
    db.setConfig('custom_key', 'custom_value');
    expect(db.getConfig('custom_key')).toBe('custom_value');
  });

  test('update existing config', () => {
    db.setConfig('version', '2');
    expect(db.getConfig('version')).toBe('2');
  });

  test('get non-existent config returns null', () => {
    expect(db.getConfig('nonexistent_key')).toBeNull();
  });

  test('getAllConfigs', () => {
    const configs = db.getAllConfigs();
    expect(configs.version).toBe('1');
    expect(configs.embedding_model).toBe('text-embedding-3-small');
  });
});

describe('Stats', () => {
  test('empty database stats', () => {
    const stats = db.getStats();
    expect(stats.pages.total).toBe(0);
    expect(stats.pages.by_type).toEqual({});
    expect(stats.links).toBe(0);
    expect(stats.tags).toBe(0);
    expect(stats.timeline_entries).toBe(0);
    expect(stats.embeddings).toBe(0);
    expect(stats.raw_data).toBe(0);
    expect(stats.db_size_bytes).toBeGreaterThan(0);
  });

  test('stats reflect data', () => {
    const id1 = db.putPage('a', { type: 'person', title: 'A' });
    const id2 = db.putPage('b', { type: 'company', title: 'B' });
    db.putPage('c', { type: 'person', title: 'C' });
    db.addTag(id1, 'founder');
    db.addLink('a', 'b', 'ctx');
    db.addTimelineEntry(id1, { date: '2026-01-01', summary: 'Event' });

    const stats = db.getStats();
    expect(stats.pages.total).toBe(3);
    expect(stats.pages.by_type.person).toBe(2);
    expect(stats.pages.by_type.company).toBe(1);
    expect(stats.tags).toBe(1);
    expect(stats.links).toBe(1);
    expect(stats.timeline_entries).toBe(1);
  });
});

describe('RawData', () => {
  test('set and get raw data', () => {
    const id = db.putPage('test/page', { type: 'person', title: 'Test' });
    db.setRawData(id, 'crustdata', { name: 'Alice', score: 95 });

    const data = db.getRawData('test/page', 'crustdata');
    // getRawData returns { source_key: parsed_data }
    expect(data).toEqual({ crustdata: { name: 'Alice', score: 95 } });
  });

  test('get all raw data for a page', () => {
    const id = db.putPage('test/page', { type: 'person', title: 'Test' });
    db.setRawData(id, 'source1', { a: 1 });
    db.setRawData(id, 'source2', { b: 2 });

    const data = db.getRawData('test/page');
    expect(data.source1).toEqual({ a: 1 });
    expect(data.source2).toEqual({ b: 2 });
  });

  test('raw data of non-existent page returns empty', () => {
    expect(db.getRawData('non/existent')).toEqual({});
  });

  test('update raw data', () => {
    const id = db.putPage('test/page', { type: 'person', title: 'Test' });
    db.setRawData(id, 'source', { v: 1 });
    db.setRawData(id, 'source', { v: 2 });

    const data = db.getRawData('test/page', 'source');
    expect(data).toEqual({ source: { v: 2 } });
  });
});

describe('IngestLog', () => {
  test('add and retrieve ingest log', () => {
    db.addIngestLog({
      source_type: 'meeting',
      source_ref: 'meeting-123',
      pages_updated: ['people/alice', 'companies/acme'],
      summary: 'Discussed funding',
    });

    // Verify through raw query since there's no dedicated getter
    const database = db.getDatabase();
    const rows = database.query('SELECT * FROM ingest_log').all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].source_type).toBe('meeting');
    expect(rows[0].source_ref).toBe('meeting-123');
    expect(JSON.parse(rows[0].pages_updated)).toEqual(['people/alice', 'companies/acme']);
    expect(rows[0].summary).toBe('Discussed funding');
  });
});

describe('Transaction', () => {
  test('successful transaction commits', () => {
    db.transaction(() => {
      db.putPage('a', { type: 'note', title: 'A' });
      db.putPage('b', { type: 'note', title: 'B' });
    });

    expect(db.getPage('a')).not.toBeNull();
    expect(db.getPage('b')).not.toBeNull();
  });

  test('rolled back transaction discards changes', () => {
    db.putPage('a', { type: 'note', title: 'A' });

    try {
      db.transaction(() => {
        db.deletePage('a');
        throw new Error('force rollback');
      });
    } catch {
      // expected
    }

    expect(db.getPage('a')).not.toBeNull();
  });
});
