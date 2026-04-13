import { describe, test, expect } from 'bun:test';
import { chunkText, cosineSimilarity } from '../src/core/embeddings';

describe('chunkText', () => {
  test('page strategy returns single chunk', () => {
    const text = 'Line one.\n\nLine two.\n\nLine three.';
    const chunks = chunkText(text, 'page');

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  test('section strategy splits by ## headers', () => {
    const text = `Intro paragraph.

## Section One
Content of section one.

## Section Two
Content of section two.`;

    const chunks = chunkText(text, 'section');

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some(c => c.includes('Section One'))).toBe(true);
    expect(chunks.some(c => c.includes('Section Two'))).toBe(true);
  });

  test('section strategy handles single section', () => {
    const text = `## Only Section
Some content.`;
    const chunks = chunkText(text, 'section');

    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  test('paragraph strategy splits by blank lines', () => {
    const text = `First paragraph.

Second paragraph.

Third paragraph.`;

    const chunks = chunkText(text, 'paragraph');

    expect(chunks).toHaveLength(3);
    expect(chunks[0].trim()).toBe('First paragraph.');
    expect(chunks[1].trim()).toBe('Second paragraph.');
    expect(chunks[2].trim()).toBe('Third paragraph.');
  });

  test('paragraph strategy filters empty paragraphs', () => {
    const text = `First.



Second.`;

    const chunks = chunkText(text, 'paragraph');
    expect(chunks).toHaveLength(2);
  });

  test('empty content returns single empty chunk for page', () => {
    const chunks = chunkText('', 'page');
    // page strategy always returns the text as-is
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('');
  });

  test('empty content returns empty array for paragraph', () => {
    const chunks = chunkText('', 'paragraph');
    expect(chunks).toHaveLength(0);
  });

  test('unknown strategy falls back to single chunk', () => {
    const chunks = chunkText('some text', 'unknown' as any);
    expect(chunks).toHaveLength(1);
  });
});

describe('cosineSimilarity', () => {
  test('identical vectors return 1', () => {
    const v = new Float32Array([1, 2, 3, 4]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  test('orthogonal vectors return 0', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  test('opposite vectors return -1', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([-1, -2, -3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  test('zero vector returns 0', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([0, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  test('both zero vectors return 0', () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([0, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  test('throws on mismatched lengths', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2]);
    expect(() => cosineSimilarity(a, b)).toThrow('Vectors must have the same length');
  });

  test('single dimension vectors', () => {
    const a = new Float32Array([5]);
    const b = new Float32Array([3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });

  test('high-dimensional vectors', () => {
    const n = 1024;
    const a = new Float32Array(n);
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      a[i] = ((i % 17) - 8) / 8;
      b[i] = (((i * 7) % 19) - 9) / 9;
    }
    const sim = cosineSimilarity(a, b);
    const epsilon = 1e-6;
    expect(sim).toBeGreaterThanOrEqual(-1 - epsilon);
    expect(sim).toBeLessThanOrEqual(1 + epsilon);
  });
});
