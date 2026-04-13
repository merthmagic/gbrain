import { BrainDB } from '../core/db.js';

export default async function timeline(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing slug argument');
    console.error('Usage: gbrain timeline <slug> [--limit N]');
    process.exit(1);
  }

  const slug = args[0];
  const limit = flags.limit ? parseInt(flags.limit, 10) : undefined;

  const page = db.getPage(slug);
  if (!page) {
    console.error(`Error: Page not found: ${slug}`);
    process.exit(1);
  }

  const entries = db.getTimeline(slug, limit);

  if (flags.json) {
    console.log(JSON.stringify({ slug, entries }, null, 2));
  } else {
    console.log(`Timeline for ${slug}:`);
    if (entries.length === 0) {
      console.log('  (no entries)');
    } else {
      for (const entry of entries) {
        console.log(`  ${entry.date} | ${entry.source ? entry.source + ' — ' : ''}${entry.summary}`);
        if (entry.detail) {
          console.log(`    ${entry.detail}`);
        }
      }
    }
  }
}
