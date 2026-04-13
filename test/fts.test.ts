import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { BrainDB } from '../src/core/db';
import { searchFTS } from '../src/core/fts';

let db: BrainDB;

beforeEach(() => {
  db = new BrainDB(':memory:');
  // Seed some data for search tests
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
});

afterEach(() => {
  db.close();
});

describe('searchFTS', () => {
  test('finds pages by title match', () => {
    const results = searchFTS(db.getDatabase(), 'Alice');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.slug === 'people/alice')).toBe(true);
  });

  test('finds pages by content match', () => {
    const results = searchFTS(db.getDatabase(), 'copilots');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.slug === 'companies/acme-ai')).toBe(true);
  });

  test('finds pages by multi-word query', () => {
    const results = searchFTS(db.getDatabase(), 'enterprise software');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.slug === 'people/bob')).toBe(true);
  });

  test('filter by type', () => {
    const results = searchFTS(db.getDatabase(), 'AI', { type: 'company' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every(r => r.type === 'company')).toBe(true);
  });

  test('limit results', () => {
    db.putPage('a', { type: 'person', title: 'AI Person A', compiled_truth: 'AI stuff' });
    db.putPage('b', { type: 'person', title: 'AI Person B', compiled_truth: 'AI things' });

    const results = searchFTS(db.getDatabase(), 'AI', { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  test('no matches returns empty', () => {
    const results = searchFTS(db.getDatabase(), 'xyznonexistent123');
    expect(results).toHaveLength(0);
  });

  test('results have expected fields', () => {
    const results = searchFTS(db.getDatabase(), 'Alice');
    const first = results[0];

    expect(first).toHaveProperty('page_id');
    expect(first).toHaveProperty('slug');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('type');
    expect(first).toHaveProperty('score');
    expect(first).toHaveProperty('snippet');
  });

  test('results are ranked by relevance', () => {
    const results = searchFTS(db.getDatabase(), 'founder');
    // First result should have highest score (lowest rank value)
    if (results.length >= 2) {
      expect(results[0].score).toBeLessThanOrEqual(results[1].score);
    }
  });
});
