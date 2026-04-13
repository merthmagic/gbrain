import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BrainDB } from '../src/core/db';
import importCmd from '../src/commands/import';
import exportCmd from '../src/commands/export';

// Mock process.exit to prevent test process from dying
const origExit = process.exit;
beforeEach(() => {
  process.exit = (() => { throw new Error('process.exit called'); }) as any;
});
afterEach(() => {
  process.exit = origExit;
});

// Capture console output
function captureConsole(): { logs: string[]; errors: string[]; restore: () => void } {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;

  console.log = (...args: any[]) => logs.push(args.join(' '));
  console.error = (...args: any[]) => errors.push(args.join(' '));
  console.warn = (...args: any[]) => errors.push(args.join(' '));

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

describe('Import', () => {
  let db: BrainDB;
  let tmpDir: string;
  let cap: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    db = new BrainDB(':memory:');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrain-test-import-'));
    cap = captureConsole();
  });

  afterEach(() => {
    cap.restore();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('imports a single markdown file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.md'), `---
type: note
title: Test Note
---

Some content here.
`);

    await importCmd([tmpDir], {}, db);

    const page = db.getPage('test');
    expect(page).not.toBeNull();
    expect(page!.title).toBe('Test Note');
    expect(page!.type).toBe('note');
    expect(page!.compiled_truth).toBe('Some content here.');
  });

  test('imports nested directory structure', async () => {
    fs.mkdirSync(path.join(tmpDir, 'people'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'companies'), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, 'people', 'alice.md'), `---
type: person
title: Alice
---

Alice content.
`);
    fs.writeFileSync(path.join(tmpDir, 'companies', 'acme.md'), `---
type: company
title: Acme
---

Acme content.
`);

    await importCmd([tmpDir], {}, db);

    expect(db.getPage('people/alice')).not.toBeNull();
    expect(db.getPage('companies/acme')).not.toBeNull();
    expect(db.listPages()).toHaveLength(2);
  });

  test('extracts tags from frontmatter', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.md'), `---
type: person
title: Alice
tags:
  - founder
  - ai
---

Content.
`);

    await importCmd([tmpDir], {}, db);

    const pageId = db.getPage('test')!.id;
    const tags = db.getTags('test');
    expect(tags).toContain('founder');
    expect(tags).toContain('ai');
  });

  test('extracts and creates links after all pages are imported', async () => {
    fs.mkdirSync(path.join(tmpDir, 'people'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'companies'), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, 'people', 'alice.md'), `---
type: person
title: Alice
---

Founder of [Acme](../companies/acme.md).
`);
    fs.writeFileSync(path.join(tmpDir, 'companies', 'acme.md'), `---
type: company
title: Acme
---

Company content.
`);

    await importCmd([tmpDir], {}, db);

    const backlinks = db.getBacklinks('companies/acme');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].slug).toBe('people/alice');
  });

  test('skips files missing type or title', async () => {
    fs.writeFileSync(path.join(tmpDir, 'no-type.md'), `---
title: No Type
---

Content.
`);
    fs.writeFileSync(path.join(tmpDir, 'valid.md'), `---
type: note
title: Valid
---

Content.
`);

    await importCmd([tmpDir], {}, db);

    expect(db.getPage('valid')).not.toBeNull();
    expect(db.getPage('no-type')).toBeNull();
  });

  test('splits compiled_truth and timeline', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.md'), `---
type: person
title: Alice
---

Current summary.

---

2026-01-01 First event.
2026-02-01 Second event.
`);

    await importCmd([tmpDir], {}, db);

    const page = db.getPage('test')!;
    expect(page!.compiled_truth).toBe('Current summary.');
    expect(page!.timeline).toContain('2026-01-01 First event.');
    expect(page!.timeline).toContain('2026-02-01 Second event.');
  });

  test('stores raw data for round-trip export', async () => {
    const filePath = path.join(tmpDir, 'test.md');
    fs.writeFileSync(filePath, `---
type: note
title: Test
---

Content.
`);

    await importCmd([tmpDir], {}, db);

    const rawData = db.getRawData('test');
    expect(Object.keys(rawData).length).toBeGreaterThan(0);
    // The raw content should be stored
    const rawContent = Object.values(rawData)[0] as any;
    expect(rawContent).toContain('type: note');
    expect(rawContent).toContain('Content.');
  });

  test('records ingest log', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.md'), `---
type: note
title: Test
---

Content.
`);

    await importCmd([tmpDir], {}, db);

    const database = db.getDatabase();
    const logs = database.query('SELECT * FROM ingest_log').all() as any[];
    expect(logs).toHaveLength(1);
    expect(logs[0].source_type).toBe('import');
  });

  test('handles empty directory gracefully', async () => {
    await importCmd([tmpDir], {}, db);

    expect(db.listPages()).toHaveLength(0);
  });

  test('errors on non-existent directory', async () => {
    await expect(importCmd(['/nonexistent/path'], {}, db)).rejects.toThrow();
  });

  test('imports real examples/minimal-notes dataset', async () => {
    const examplesDir = path.resolve(import.meta.dir, '..', 'examples', 'minimal-notes');
    if (!fs.existsSync(examplesDir)) return;

    await importCmd([examplesDir], {}, db);

    const pages = db.listPages();
    expect(pages.length).toBeGreaterThanOrEqual(4);

    // Verify cross-links
    const acmeBacklinks = db.getBacklinks('companies/acme-ai');
    expect(acmeBacklinks.length).toBeGreaterThanOrEqual(1);

    // Verify FTS works on imported data
    const { searchFTS } = await import('../src/core/fts');
    const results = searchFTS(db.getDatabase(), 'copilot');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Export', () => {
  let db: BrainDB;
  let tmpDir: string;
  let cap: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    db = new BrainDB(':memory:');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrain-test-export-'));
    cap = captureConsole();
  });

  afterEach(() => {
    cap.restore();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('exports pages to markdown files', async () => {
    db.putPage('people/alice', {
      type: 'person',
      title: 'Alice Zhang',
      compiled_truth: 'Founder of Acme AI.',
      frontmatter: { type: 'person', title: 'Alice Zhang' },
    });

    await exportCmd([], { dir: tmpDir }, db);

    const filePath = path.join(tmpDir, 'people', 'alice.md');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('Alice Zhang');
    expect(content).toContain('Founder of Acme AI.');
    expect(content).toContain('type: person');
  });

  test('creates nested directories', async () => {
    db.putPage('deep/nested/page', {
      type: 'note',
      title: 'Nested',
      compiled_truth: 'Content.',
    });

    await exportCmd([], { dir: tmpDir }, db);

    expect(fs.existsSync(path.join(tmpDir, 'deep', 'nested', 'page.md'))).toBe(true);
  });

  test('exports page with timeline', async () => {
    db.putPage('test/page', {
      type: 'note',
      title: 'Test',
      compiled_truth: 'Summary.',
      timeline: '2026-01-01 Event.',
    });

    await exportCmd([], { dir: tmpDir }, db);

    const content = fs.readFileSync(path.join(tmpDir, 'test', 'page.md'), 'utf-8');
    expect(content).toContain('Summary.');
    expect(content).toContain('2026-01-01 Event.');
  });

  test('handles empty database', async () => {
    await exportCmd([], { dir: tmpDir }, db);

    expect(cap.logs.some(l => l.includes('No pages'))).toBe(true);
  });
});

describe('Import → Export Round-Trip', () => {
  let db: BrainDB;
  let importDir: string;
  let exportDir: string;
  let cap: ReturnType<typeof captureConsole>;

  beforeEach(() => {
    db = new BrainDB(':memory:');
    importDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrain-test-rt-import-'));
    exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbrain-test-rt-export-'));
    cap = captureConsole();
  });

  afterEach(() => {
    cap.restore();
    db.close();
    fs.rmSync(importDir, { recursive: true, force: true });
    fs.rmSync(exportDir, { recursive: true, force: true });
  });

  test('single file round-trip preserves content', async () => {
    const aliceDir = path.join(importDir, 'people');
    fs.mkdirSync(aliceDir, { recursive: true });

    const original = `---
type: person
title: Alice Zhang
tags:
  - founder
  - ai
---

Alice is building an applied AI startup.

---

2026-04-10 Joined YC.
`;

    fs.writeFileSync(path.join(aliceDir, 'alice.md'), original);

    await importCmd([importDir], {}, db);
    await exportCmd([], { dir: exportDir }, db);

    const exported = fs.readFileSync(path.join(exportDir, 'people', 'alice.md'), 'utf-8');
    // The export command stores raw content under the file path key.
    // The first export uses renderPage (no matching rawData.data key),
    // but the raw data from import is preserved in DB.
    // Key fields must survive the round-trip:
    expect(exported).toContain('type: person');
    expect(exported).toContain('title: Alice Zhang');
    expect(exported).toContain('Alice is building an applied AI startup.');
    expect(exported).toContain('2026-04-10 Joined YC.');
  });

  test('multi-file round-trip preserves content structure', async () => {
    const files: Record<string, string> = {
      'people/alice.md': `---
type: person
title: Alice
---

Alice content.
`,
      'companies/acme.md': `---
type: company
title: Acme
---

Acme content.
`,
      'projects/ops.md': `---
type: project
title: Ops Copilot
---

Project content.
`,
    };

    for (const [rel, content] of Object.entries(files)) {
      const filePath = path.join(importDir, rel);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }

    await importCmd([importDir], {}, db);
    await exportCmd([], { dir: exportDir }, db);

    // Verify all files were exported with correct content
    for (const [rel, original] of Object.entries(files)) {
      const exportedPath = path.join(exportDir, rel);
      expect(fs.existsSync(exportedPath)).toBe(true);
      const exported = fs.readFileSync(exportedPath, 'utf-8');
      // Content key fields should be preserved (round-trip via raw data)
      expect(exported).toContain('title:');
      expect(exported).toContain('type:');
    }

    // Verify DB has all pages
    expect(db.listPages()).toHaveLength(3);
  });

  test('round-trip preserves links', async () => {
    const peopleDir = path.join(importDir, 'people');
    const companiesDir = path.join(importDir, 'companies');
    fs.mkdirSync(peopleDir, { recursive: true });
    fs.mkdirSync(companiesDir, { recursive: true });

    fs.writeFileSync(path.join(peopleDir, 'alice.md'), `---
type: person
title: Alice
---

Works at [Acme](../companies/acme.md).
`);
    fs.writeFileSync(path.join(companiesDir, 'acme.md'), `---
type: company
title: Acme
---

Company info.
`);

    await importCmd([importDir], {}, db);

    // Verify links in DB
    const backlinks = db.getBacklinks('companies/acme');
    expect(backlinks).toHaveLength(1);

    // Export and re-import
    await exportCmd([], { dir: exportDir }, db);

    const db2 = new BrainDB(':memory:');
    const cap2 = captureConsole();
    process.exit = (() => { throw new Error('process.exit called'); }) as any;
    await importCmd([exportDir], {}, db2);
    cap2.restore();

    // Verify links survived the round-trip
    const backlinks2 = db2.getBacklinks('companies/acme');
    expect(backlinks2).toHaveLength(1);

    db2.close();
  });

  test('round-trip preserves tags', async () => {
    fs.writeFileSync(path.join(importDir, 'test.md'), `---
type: person
title: Alice
tags:
  - founder
  - ai
  - yc-alum
---

Content.
`);

    await importCmd([importDir], {}, db);
    await exportCmd([], { dir: exportDir }, db);

    const db2 = new BrainDB(':memory:');
    const cap2 = captureConsole();
    process.exit = (() => { throw new Error('process.exit called'); }) as any;
    await importCmd([exportDir], {}, db2);
    cap2.restore();

    const tags = db2.getTags('test');
    expect(tags).toContain('founder');
    expect(tags).toContain('ai');
    expect(tags).toContain('yc-alum');

    db2.close();
  });

  test('real examples/minimal-notes round-trip', async () => {
    const examplesDir = path.resolve(import.meta.dir, '..', 'examples', 'minimal-notes');
    if (!fs.existsSync(examplesDir)) return;

    // Import original
    await importCmd([examplesDir], {}, db);
    const originalPages = db.listPages();

    // Export
    await exportCmd([], { dir: exportDir }, db);

    // Re-import exported data into fresh DB
    const db2 = new BrainDB(':memory:');
    const cap2 = captureConsole();
    process.exit = (() => { throw new Error('process.exit called'); }) as any;
    await importCmd([exportDir], {}, db2);
    cap2.restore();

    // Verify same number of pages
    const roundTripPages = db2.listPages();
    expect(roundTripPages.length).toBe(originalPages.length);

    // Verify page titles match
    const originalTitles = originalPages.map(p => p.title).sort();
    const roundTripTitles = roundTripPages.map(p => p.title).sort();
    expect(roundTripTitles).toEqual(originalTitles);

    // Verify links preserved
    const originalStats = db.getStats();
    const roundTripStats = db2.getStats();
    expect(roundTripStats.links).toBe(originalStats.links);

    db2.close();
  });
});
