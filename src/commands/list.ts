import { BrainDB } from '../core/db.js';

export default async function list(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  const limit = flags.limit ? parseInt(flags.limit, 10) : undefined;
  const offset = flags.offset ? parseInt(flags.offset, 10) : undefined;
  const type = flags.type;
  const tag = flags.tag;

  const pages = db.listPages({ type, tag, limit, offset });

  if (flags.json) {
    console.log(JSON.stringify(pages, null, 2));
  } else {
    if (pages.length === 0) {
      console.log('No pages found.');
      return;
    }

    console.log(`Found ${pages.length} page(s):\n`);
    for (const page of pages) {
      console.log(`  ${page.slug} (${page.type}) - ${page.title}`);
    }
  }
}
