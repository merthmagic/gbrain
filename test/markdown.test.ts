import { describe, test, expect } from 'bun:test';
import { parseMarkdown, renderPage } from '../src/core/markdown';
import type { Page } from '../src/core/types';

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: 1,
    slug: 'test/page',
    type: 'person',
    title: 'Test Page',
    compiled_truth: 'Main content here.',
    timeline: '2026-04-10 Some event.',
    frontmatter: { type: 'person', title: 'Test Page', tags: ['test'] },
    created_at: '2026-04-10T00:00:00Z',
    updated_at: '2026-04-10T00:00:00Z',
    ...overrides,
  };
}

describe('parseMarkdown', () => {
  test('parses frontmatter, compiled_truth and timeline', () => {
    const content = `---
type: person
title: Alice Zhang
tags: [founder, ai]
---

Alice founded Acme AI.

---

2026-04-10 Joined YC.`;

    const result = parseMarkdown(content);
    expect(result.frontmatter.type).toBe('person');
    expect(result.frontmatter.title).toBe('Alice Zhang');
    expect(result.frontmatter.tags).toEqual(['founder', 'ai']);
    expect(result.compiledTruth).toBe('Alice founded Acme AI.');
    expect(result.timeline).toBe('2026-04-10 Joined YC.');
  });

  test('no separator: everything goes to compiled_truth', () => {
    const content = `---
type: note
title: No Timeline
---

All content is above the line.`;

    const result = parseMarkdown(content);
    expect(result.frontmatter.title).toBe('No Timeline');
    expect(result.compiledTruth).toBe('All content is above the line.');
    expect(result.timeline).toBe('');
  });

  test('no frontmatter: returns empty frontmatter', () => {
    const content = `Just some plain content with no frontmatter.`;

    const result = parseMarkdown(content);
    expect(result.frontmatter).toEqual({});
    expect(result.compiledTruth).toBe('Just some plain content with no frontmatter.');
    expect(result.timeline).toBe('');
  });

  test('empty content', () => {
    const result = parseMarkdown('');
    expect(result.frontmatter).toEqual({});
    expect(result.compiledTruth).toBe('');
    expect(result.timeline).toBe('');
  });

  test('frontmatter only, no body', () => {
    const content = `---
type: company
title: Empty Corp
---`;

    const result = parseMarkdown(content);
    expect(result.frontmatter.type).toBe('company');
    expect(result.compiledTruth).toBe('');
    expect(result.timeline).toBe('');
  });

  test('multiple timeline entries after separator', () => {
    const content = `---
type: person
title: Multi
---

Summary here.

---

2026-01-01 First event.
2026-02-01 Second event.`;

    const result = parseMarkdown(content);
    expect(result.compiledTruth).toBe('Summary here.');
    expect(result.timeline).toContain('2026-01-01 First event.');
    expect(result.timeline).toContain('2026-02-01 Second event.');
  });

  test('separator at the start of body', () => {
    const content = `---
type: note
---

---

Only timeline content.`;

    const result = parseMarkdown(content);
    expect(result.compiledTruth).toBe('');
    expect(result.timeline).toBe('Only timeline content.');
  });
});

describe('renderPage', () => {
  test('renders page with frontmatter and timeline', () => {
    const page = makePage();
    const result = renderPage(page);

    expect(result).toContain('---');
    expect(result).toContain('type: person');
    expect(result).toContain('Main content here.');
    expect(result).toContain('---\n\n2026-04-10 Some event.');
  });

  test('renders page without timeline', () => {
    const page = makePage({ timeline: '' });
    const result = renderPage(page);

    expect(result).toContain('Main content here.');
    // Should not have trailing separator when no timeline
    expect(result.trim().endsWith('Main content here.')).toBe(true);
  });

  test('renders page with empty frontmatter', () => {
    const page = makePage({ frontmatter: {} });
    const result = renderPage(page);

    // Empty frontmatter should not produce --- delimiters
    expect(result.startsWith('Main content')).toBe(true);
  });

  test('round-trip: parseMarkdown then renderPage preserves content', () => {
    const content = `---
type: company
title: Acme AI
tags: [startup]
---

Acme AI builds copilots.

---

2026-04-10 Raised Series A.`;

    const parsed = parseMarkdown(content);
    const page = makePage({
      type: parsed.frontmatter.type as any,
      title: parsed.frontmatter.title as string,
      frontmatter: parsed.frontmatter,
      compiled_truth: parsed.compiledTruth,
      timeline: parsed.timeline,
    });
    const rendered = renderPage(page);

    expect(rendered).toContain('type: company');
    expect(rendered).toContain('title: Acme AI');
    expect(rendered).toContain('Acme AI builds copilots.');
    expect(rendered).toContain('2026-04-10 Raised Series A.');
  });
});
