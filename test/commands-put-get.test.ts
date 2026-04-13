import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Readable } from 'stream';
import { BrainDB } from '../src/core/db';
import get from '../src/commands/get';
import put from '../src/commands/put';

function mockStdin(content: string): Readable {
  const stream = new Readable();
  stream.push(content);
  stream.push(null);
  return stream;
}

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

const SAMPLE_MARKDOWN = `---
type: note
title: My Test Page
tags: [test, important]
---

This is the main content.

---

## Timeline

- 2024-01-01: Something happened
`;

describe('get command', () => {
  let db: BrainDB;
  const origExit = process.exit;
  const origStdin = process.stdin;

  beforeEach(() => {
    db = new BrainDB(':memory:');
    process.exit = (() => { throw new Error('process.exit(1)'); }) as any;
  });

  afterEach(() => {
    db.close();
    process.exit = origExit;
    process.stdin = origStdin;
  });

  test('gets existing page and outputs markdown', () => {
    db.putPage('notes/test-page', {
      type: 'note',
      title: 'Test Page',
      compiled_truth: 'Hello world.',
      frontmatter: { type: 'note', title: 'Test Page' },
    });

    const cap = captureConsole();
    try {
      get(['notes/test-page'], {}, db);
    } finally {
      cap.restore();
    }

    expect(cap.logs.length).toBeGreaterThan(0);
    const output = cap.logs.join('\n');
    expect(output).toContain('Test Page');
    expect(output).toContain('Hello world.');
  });

  test('gets page with --json flag', () => {
    db.putPage('notes/json-test', {
      type: 'note',
      title: 'JSON Test',
      compiled_truth: 'Content here.',
    });

    const cap = captureConsole();
    try {
      get(['notes/json-test'], { json: 'true' }, db);
    } finally {
      cap.restore();
    }

    expect(cap.logs.length).toBe(1);
    const parsed = JSON.parse(cap.logs[0]);
    expect(parsed.slug).toBe('notes/json-test');
    expect(parsed.title).toBe('JSON Test');
    expect(parsed.compiled_truth).toBe('Content here.');
    expect(parsed.id).toBeGreaterThan(0);
  });

  test('error on missing slug argument', () => {
    const cap = captureConsole();
    try {
      expect(() => get([], {}, db)).toThrow('process.exit(1)');
    } catch {
      // Expected
    } finally {
      cap.restore();
    }

    expect(cap.errors).toContain('Error: Missing slug argument');
    expect(cap.errors).toContain('Usage: gbrain get <slug>');
  });

  test('error on non-existent page', () => {
    const cap = captureConsole();
    try {
      expect(() => get(['does/not/exist'], {}, db)).toThrow('process.exit(1)');
    } catch {
      // Expected
    } finally {
      cap.restore();
    }

    expect(cap.errors).toContain('Error: Page not found: does/not/exist');
  });
});

describe('put command', () => {
  let db: BrainDB;
  const origExit = process.exit;
  const origStdin = process.stdin;

  beforeEach(() => {
    db = new BrainDB(':memory:');
    process.exit = (() => { throw new Error('process.exit(1)'); }) as any;
  });

  afterEach(() => {
    db.close();
    process.exit = origExit;
    process.stdin = origStdin;
  });

  test('creates a new page from stdin', async () => {
    process.stdin = mockStdin(SAMPLE_MARKDOWN) as any;

    const cap = captureConsole();
    try {
      await put(['notes/my-test-page'], {}, db);
    } finally {
      cap.restore();
    }

    const page = db.getPage('notes/my-test-page');
    expect(page).not.toBeNull();
    expect(page!.title).toBe('My Test Page');
    expect(page!.type).toBe('note');
    expect(page!.compiled_truth).toContain('This is the main content.');
    expect(page!.timeline).toContain('Something happened');
  });

  test('updates an existing page', async () => {
    process.stdin = mockStdin(SAMPLE_MARKDOWN) as any;
    await put(['notes/update-test'], {}, db);

    const updatedMarkdown = `---
type: note
title: Updated Title
---

Updated content.
`;
    process.stdin = mockStdin(updatedMarkdown) as any;

    const cap = captureConsole();
    try {
      await put(['notes/update-test'], {}, db);
    } finally {
      cap.restore();
    }

    expect(cap.logs.some(l => l.includes('updated'))).toBe(true);

    const page = db.getPage('notes/update-test');
    expect(page).not.toBeNull();
    expect(page!.title).toBe('Updated Title');
    expect(page!.compiled_truth).toContain('Updated content.');
  });

  test('extracts and creates tags', async () => {
    process.stdin = mockStdin(SAMPLE_MARKDOWN) as any;
    await put(['notes/tagged-page'], {}, db);

    const tags = db.getTags('notes/tagged-page');
    expect(tags).toContain('test');
    expect(tags).toContain('important');
    expect(tags.length).toBe(2);
  });

  test('error on missing slug', async () => {
    const cap = captureConsole();
    try {
      await expect(put([], {}, db)).rejects.toThrow('process.exit(1)');
    } catch {
      // Expected
    } finally {
      cap.restore();
    }

    expect(cap.errors).toContain('Error: Missing slug argument');
    expect(cap.errors).toContain('Usage: gbrain put <slug> [< file.md]');
  });

  test('error on empty stdin', async () => {
    process.stdin = mockStdin('   \n\n  ') as any;

    const cap = captureConsole();
    try {
      await expect(put(['notes/empty'], {}, db)).rejects.toThrow('process.exit(1)');
    } catch {
      // Expected
    } finally {
      cap.restore();
    }

    expect(cap.errors).toContain('Error: No content provided. Pipe markdown content via stdin.');
  });

  test('error on missing type in frontmatter', async () => {
    const noTypeMarkdown = `---
title: No Type Page
---

Some content.
`;
    process.stdin = mockStdin(noTypeMarkdown) as any;

    const cap = captureConsole();
    try {
      await expect(put(['notes/no-type'], {}, db)).rejects.toThrow('process.exit(1)');
    } catch {
      // Expected
    } finally {
      cap.restore();
    }

    expect(cap.errors).toContain('Error: Missing required field "type" in frontmatter');
  });

  test('error on missing title in frontmatter', async () => {
    const noTitleMarkdown = `---
type: note
---

Some content.
`;
    process.stdin = mockStdin(noTitleMarkdown) as any;

    const cap = captureConsole();
    try {
      await expect(put(['notes/no-title'], {}, db)).rejects.toThrow('process.exit(1)');
    } catch {
      // Expected
    } finally {
      cap.restore();
    }

    expect(cap.errors).toContain('Error: Missing required field "title" in frontmatter');
  });

  test('--json output format', async () => {
    process.stdin = mockStdin(SAMPLE_MARKDOWN) as any;

    const cap = captureConsole();
    try {
      await put(['notes/json-output'], { json: 'true' }, db);
    } finally {
      cap.restore();
    }

    expect(cap.logs.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(cap.logs[0]);
    expect(parsed.slug).toBe('notes/json-output');
    expect(parsed.pageId).toBeGreaterThan(0);
    expect(parsed.links).toBe(0);
    expect(parsed.tags).toBe(2);
  });

  test('timeline is appended on update', async () => {
    const firstMarkdown = `---
type: note
title: Timeline Test
---

Initial content.

---

## Timeline

- 2024-01-01: First event
`;
    process.stdin = mockStdin(firstMarkdown) as any;
    await put(['notes/timeline-append'], {}, db);

    const secondMarkdown = `---
type: note
title: Timeline Test
---

Updated content.

---

## Timeline

- 2024-06-01: Second event
`;
    process.stdin = mockStdin(secondMarkdown) as any;
    await put(['notes/timeline-append'], {}, db);

    const page = db.getPage('notes/timeline-append');
    expect(page).not.toBeNull();
    expect(page!.compiled_truth).toContain('Updated content.');
    expect(page!.timeline).toContain('First event');
    expect(page!.timeline).toContain('Second event');
  });
});
