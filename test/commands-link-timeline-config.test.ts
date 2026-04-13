import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { BrainDB } from '../src/core/db';
import linkCmd from '../src/commands/link';
import unlinkCmd from '../src/commands/unlink';
import backlinksCmd from '../src/commands/backlinks';
import timelineCmd from '../src/commands/timeline';
import timelineAddCmd from '../src/commands/timeline-add';
import configCmd from '../src/commands/config';

let db: BrainDB;

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

function mockProcessExit() {
  const origExit = process.exit;
  process.exit = (() => {
    throw new Error('process.exit(1)');
  }) as any;
  return () => {
    process.exit = origExit;
  };
}

beforeEach(() => {
  db = new BrainDB(':memory:');
});

afterEach(() => {
  db.close();
});

// ============================================================
// link command
// ============================================================
describe('link command', () => {
  test('creates a link between two pages', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });

    const cap = captureConsole();
    await linkCmd(['people/alice', 'companies/acme'], {}, db);
    cap.restore();

    expect(cap.logs).toEqual(['Linked people/alice -> companies/acme']);

    // Verify link exists in DB
    const backlinks = db.getBacklinks('companies/acme');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].slug).toBe('people/alice');
  });

  test('error on missing arguments (less than 2)', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(linkCmd(['only-one'], {}, db)).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Missing arguments');
    expect(cap.errors).toContain('Usage: gbrain link <from-slug> <to-slug> [--context "..."]');
  });

  test('error on missing arguments (zero args)', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(linkCmd([], {}, db)).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Missing arguments');
  });

  test('error when one page does not exist', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    // 'companies/nonexistent' is not created

    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(
      linkCmd(['people/alice', 'companies/nonexistent'], {}, db)
    ).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors.some((e) => e.includes('Error creating link'))).toBe(true);
  });

  test('--json output', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });

    const cap = captureConsole();
    await linkCmd(['people/alice', 'companies/acme'], { json: 'true' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output).toEqual({
      from: 'people/alice',
      to: 'companies/acme',
      context: '',
      action: 'linked',
    });
  });

  test('--context flag', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });

    const cap = captureConsole();
    await linkCmd(['people/alice', 'companies/acme'], { context: 'Alice founded Acme' }, db);
    cap.restore();

    expect(cap.logs).toEqual(['Linked people/alice -> companies/acme']);

    // Verify the link was stored with context
    const backlinks = db.getBacklinks('companies/acme');
    expect(backlinks).toHaveLength(1);
  });

  test('--json output with --context', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });

    const cap = captureConsole();
    await linkCmd(['people/alice', 'companies/acme'], { json: 'true', context: 'Founder' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output.context).toBe('Founder');
    expect(output.action).toBe('linked');
  });
});

// ============================================================
// unlink command
// ============================================================
describe('unlink command', () => {
  test('removes a link', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });
    db.addLink('people/alice', 'companies/acme', 'ctx');

    expect(db.getBacklinks('companies/acme')).toHaveLength(1);

    const cap = captureConsole();
    await unlinkCmd(['people/alice', 'companies/acme'], {}, db);
    cap.restore();

    expect(cap.logs).toEqual(['Unlinked people/alice -> companies/acme']);
    expect(db.getBacklinks('companies/acme')).toHaveLength(0);
  });

  test('error on missing arguments (less than 2)', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(unlinkCmd(['only-one'], {}, db)).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Missing arguments');
    expect(cap.errors).toContain('Usage: gbrain unlink <from-slug> <to-slug>');
  });

  test('error on missing arguments (zero args)', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(unlinkCmd([], {}, db)).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Missing arguments');
  });

  test('unlink non-existent link does not throw', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });

    const cap = captureConsole();
    await unlinkCmd(['people/alice', 'companies/acme'], {}, db);
    cap.restore();

    expect(cap.logs).toEqual(['Unlinked people/alice -> companies/acme']);
  });

  test('--json output', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });
    db.addLink('people/alice', 'companies/acme', 'ctx');

    const cap = captureConsole();
    await unlinkCmd(['people/alice', 'companies/acme'], { json: 'true' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output).toEqual({
      from: 'people/alice',
      to: 'companies/acme',
      action: 'unlinked',
    });
  });
});

// ============================================================
// backlinks command
// ============================================================
describe('backlinks command', () => {
  test('shows backlinks for a page', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });
    db.addLink('people/alice', 'companies/acme', 'Alice founded Acme');

    const cap = captureConsole();
    await backlinksCmd(['companies/acme'], {}, db);
    cap.restore();

    expect(cap.logs).toContain('Backlinks to companies/acme:');
    expect(cap.logs).toContain('  - people/alice (person)');
  });

  test('shows (none) when no backlinks', async () => {
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });

    const cap = captureConsole();
    await backlinksCmd(['companies/acme'], {}, db);
    cap.restore();

    expect(cap.logs).toContain('Backlinks to companies/acme:');
    expect(cap.logs).toContain('  (none)');
  });

  test('error on missing slug', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(backlinksCmd([], {}, db)).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Missing slug argument');
    expect(cap.errors).toContain('Usage: gbrain backlinks <slug>');
  });

  test('--json output', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });
    db.addLink('people/alice', 'companies/acme', 'ctx');

    const cap = captureConsole();
    await backlinksCmd(['companies/acme'], { json: 'true' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output.slug).toBe('companies/acme');
    expect(output.backlinks).toHaveLength(1);
    expect(output.backlinks[0].slug).toBe('people/alice');
    expect(output.backlinks[0].type).toBe('person');
  });

  test('--json output with no backlinks', async () => {
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });

    const cap = captureConsole();
    await backlinksCmd(['companies/acme'], { json: 'true' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output.slug).toBe('companies/acme');
    expect(output.backlinks).toEqual([]);
  });

  test('shows multiple backlinks', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.putPage('people/bob', { type: 'person', title: 'Bob' });
    db.putPage('companies/acme', { type: 'company', title: 'Acme' });
    db.addLink('people/alice', 'companies/acme', 'ctx1');
    db.addLink('people/bob', 'companies/acme', 'ctx2');

    const cap = captureConsole();
    await backlinksCmd(['companies/acme'], {}, db);
    cap.restore();

    expect(cap.logs).toContain('Backlinks to companies/acme:');
    expect(cap.logs).toContain('  - people/alice (person)');
    expect(cap.logs).toContain('  - people/bob (person)');
  });
});

// ============================================================
// timeline command
// ============================================================
describe('timeline command', () => {
  test('shows timeline entries', async () => {
    const id = db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.addTimelineEntry(id, {
      date: '2026-04-10',
      source: 'meeting',
      summary: 'Joined YC',
      detail: 'S24 batch',
    });

    const cap = captureConsole();
    await timelineCmd(['people/alice'], {}, db);
    cap.restore();

    expect(cap.logs).toContain('Timeline for people/alice:');
    expect(cap.logs.some((l) => l.includes('2026-04-10'))).toBe(true);
    expect(cap.logs.some((l) => l.includes('Joined YC'))).toBe(true);
    expect(cap.logs.some((l) => l.includes('S24 batch'))).toBe(true);
  });

  test('shows (no entries) for empty timeline', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });

    const cap = captureConsole();
    await timelineCmd(['people/alice'], {}, db);
    cap.restore();

    expect(cap.logs).toContain('Timeline for people/alice:');
    expect(cap.logs).toContain('  (no entries)');
  });

  test('--limit flag', async () => {
    const id = db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.addTimelineEntry(id, { date: '2026-01-01', summary: 'First' });
    db.addTimelineEntry(id, { date: '2026-02-01', summary: 'Second' });
    db.addTimelineEntry(id, { date: '2026-03-01', summary: 'Third' });

    const cap = captureConsole();
    await timelineCmd(['people/alice'], { limit: '2' }, db);
    cap.restore();

    // Should only have 2 entries (the most recent ones due to DESC ordering)
    const entryLines = cap.logs.filter((l) => l.includes('|') && !l.includes('Timeline for'));
    expect(entryLines).toHaveLength(2);
  });

  test('error on missing slug', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(timelineCmd([], {}, db)).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Missing slug argument');
    expect(cap.errors).toContain('Usage: gbrain timeline <slug> [--limit N]');
  });

  test('error on non-existent page', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(timelineCmd(['non/existent'], {}, db)).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Page not found: non/existent');
  });

  test('--json output', async () => {
    const id = db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.addTimelineEntry(id, { date: '2026-04-10', source: 'meeting', summary: 'Joined YC' });

    const cap = captureConsole();
    await timelineCmd(['people/alice'], { json: 'true' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output.slug).toBe('people/alice');
    expect(output.entries).toHaveLength(1);
    expect(output.entries[0].date).toBe('2026-04-10');
    expect(output.entries[0].summary).toBe('Joined YC');
    expect(output.entries[0].source).toBe('meeting');
  });

  test('--json output with empty timeline', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });

    const cap = captureConsole();
    await timelineCmd(['people/alice'], { json: 'true' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output.slug).toBe('people/alice');
    expect(output.entries).toEqual([]);
  });

  test('displays source prefix in entry', async () => {
    const id = db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.addTimelineEntry(id, {
      date: '2026-04-10',
      source: 'LinkedIn',
      summary: 'Updated role',
    });

    const cap = captureConsole();
    await timelineCmd(['people/alice'], {}, db);
    cap.restore();

    expect(cap.logs.some((l) => l.includes('LinkedIn'))).toBe(true);
    expect(cap.logs.some((l) => l.includes('Updated role'))).toBe(true);
  });

  test('displays detail indented', async () => {
    const id = db.putPage('people/alice', { type: 'person', title: 'Alice' });
    db.addTimelineEntry(id, {
      date: '2026-04-10',
      summary: 'Joined YC',
      detail: 'S24 batch with Acme AI',
    });

    const cap = captureConsole();
    await timelineCmd(['people/alice'], {}, db);
    cap.restore();

    // Detail should be on a separate indented line
    expect(cap.logs.some((l) => l.includes('S24 batch with Acme AI'))).toBe(true);
    const detailLine = cap.logs.find((l) => l.includes('S24 batch'));
    expect(detailLine).toBeDefined();
    expect(detailLine!.startsWith('    ')).toBe(true);
  });
});

// ============================================================
// timeline-add command
// ============================================================
describe('timeline-add command', () => {
  test('adds a timeline entry', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });

    const cap = captureConsole();
    await timelineAddCmd(
      ['people/alice'],
      { date: '2026-04-10', summary: 'Joined YC' },
      db,
    );
    cap.restore();

    expect(cap.logs).toContain('Timeline entry added to people/alice: 2026-04-10 - Joined YC');

    const entries = db.getTimeline('people/alice');
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-04-10');
    expect(entries[0].summary).toBe('Joined YC');
  });

  test('error on missing slug', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(
      timelineAddCmd([], { date: '2026-04-10', summary: 'Test' }, db),
    ).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Missing slug argument');
    expect(cap.errors).toContain(
      'Usage: gbrain timeline-add <slug> --date <YYYY-MM-DD> --summary "..." [--source "..."] [--detail "..."]',
    );
  });

  test('error on missing --date', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });

    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(
      timelineAddCmd(['people/alice'], { summary: 'Test' }, db),
    ).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Missing --date flag');
  });

  test('error on missing --summary', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });

    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(
      timelineAddCmd(['people/alice'], { date: '2026-04-10' }, db),
    ).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Missing --summary flag');
  });

  test('error on non-existent page', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(
      timelineAddCmd(['non/existent'], { date: '2026-04-10', summary: 'Test' }, db),
    ).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Page not found: non/existent');
  });

  test('--json output', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });

    const cap = captureConsole();
    await timelineAddCmd(
      ['people/alice'],
      { date: '2026-04-10', summary: 'Joined YC', json: 'true' },
      db,
    );
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output.slug).toBe('people/alice');
    expect(output.date).toBe('2026-04-10');
    expect(output.summary).toBe('Joined YC');
    expect(output.action).toBe('added');
  });

  test('--source and --detail optional flags', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });

    const cap = captureConsole();
    await timelineAddCmd(
      ['people/alice'],
      {
        date: '2026-04-10',
        summary: 'Joined YC',
        source: 'meeting',
        detail: 'S24 batch',
      },
      db,
    );
    cap.restore();

    expect(cap.logs).toContain('Timeline entry added to people/alice: 2026-04-10 - Joined YC');

    const entries = db.getTimeline('people/alice');
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('meeting');
    expect(entries[0].detail).toBe('S24 batch');
  });

  test('--json output with --source and --detail', async () => {
    db.putPage('people/alice', { type: 'person', title: 'Alice' });

    const cap = captureConsole();
    await timelineAddCmd(
      ['people/alice'],
      {
        date: '2026-04-10',
        summary: 'Joined YC',
        source: 'LinkedIn',
        detail: 'S24 batch',
        json: 'true',
      },
      db,
    );
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output.source).toBe('LinkedIn');
    expect(output.detail).toBe('S24 batch');
    expect(output.date).toBe('2026-04-10');
    expect(output.summary).toBe('Joined YC');
  });
});

// ============================================================
// config command
// ============================================================
describe('config command', () => {
  test('lists all config (no args)', async () => {
    const cap = captureConsole();
    await configCmd([], {}, db);
    cap.restore();

    expect(cap.logs).toContain('Configuration:');
    expect(cap.logs.some((l) => l.includes('version: 1'))).toBe(true);
    expect(cap.logs.some((l) => l.includes('embedding_model: text-embedding-3-small'))).toBe(true);
  });

  test('gets a single config value (1 arg)', async () => {
    const cap = captureConsole();
    await configCmd(['version'], {}, db);
    cap.restore();

    expect(cap.logs).toContain('version: 1');
  });

  test('gets a non-existent config key', async () => {
    const cap = captureConsole();
    await configCmd(['nonexistent_key'], {}, db);
    cap.restore();

    // getConfig returns null, so it prints "key: null"
    expect(cap.logs).toContain('nonexistent_key: null');
  });

  test('sets a config value (2 args)', async () => {
    const cap = captureConsole();
    await configCmd(['custom_key', 'custom_value'], {}, db);
    cap.restore();

    expect(cap.logs).toContain('Set custom_key = custom_value');
    expect(db.getConfig('custom_key')).toBe('custom_value');
  });

  test('error on too many args (>2)', async () => {
    const cap = captureConsole();
    const restoreExit = mockProcessExit();

    await expect(configCmd(['a', 'b', 'c'], {}, db)).rejects.toThrow('process.exit(1)');

    restoreExit();
    cap.restore();

    expect(cap.errors).toContain('Error: Too many arguments');
    expect(cap.errors).toContain('Usage: gbrain config [key] [value]');
  });

  test('--json output listing all config', async () => {
    const cap = captureConsole();
    await configCmd([], { json: 'true' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output.version).toBe('1');
    expect(output.embedding_model).toBe('text-embedding-3-small');
  });

  test('--json output getting a single config', async () => {
    const cap = captureConsole();
    await configCmd(['version'], { json: 'true' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output).toEqual({ key: 'version', value: '1' });
  });

  test('--json output setting a config value', async () => {
    const cap = captureConsole();
    await configCmd(['my_key', 'my_value'], { json: 'true' }, db);
    cap.restore();

    const output = JSON.parse(cap.logs[0]);
    expect(output).toEqual({ key: 'my_key', value: 'my_value', action: 'set' });
    expect(db.getConfig('my_key')).toBe('my_value');
  });

  test('update existing config value', async () => {
    expect(db.getConfig('version')).toBe('1');

    const cap = captureConsole();
    await configCmd(['version', '2'], {}, db);
    cap.restore();

    expect(cap.logs).toContain('Set version = 2');
    expect(db.getConfig('version')).toBe('2');
  });
});
