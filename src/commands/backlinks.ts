import { BrainDB } from '../core/db.js';

export default async function backlinks(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing slug argument');
    console.error('Usage: gbrain backlinks <slug>');
    process.exit(1);
  }

  const slug = args[0];
  const pages = db.getBacklinks(slug);

  if (flags.json) {
    console.log(JSON.stringify({ slug, backlinks: pages }, null, 2));
  } else {
    console.log(`Backlinks to ${slug}:`);
    if (pages.length === 0) {
      console.log('  (none)');
    } else {
      for (const page of pages) {
        console.log(`  - ${page.slug} (${page.type})`);
      }
    }
  }
}
