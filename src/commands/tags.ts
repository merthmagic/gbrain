import { BrainDB } from '../core/db.js';

export default async function tags(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing slug argument');
    console.error('Usage: gbrain tags <slug>');
    process.exit(1);
  }

  const slug = args[0];
  const page = db.getPage(slug);

  if (!page) {
    console.error(`Error: Page not found: ${slug}`);
    process.exit(1);
  }

  const pageTags = db.getTags(slug);

  if (flags.json) {
    console.log(JSON.stringify({ slug, tags: pageTags }, null, 2));
  } else {
    console.log(`Tags for ${slug}:`);
    if (pageTags.length === 0) {
      console.log('  (none)');
    } else {
      for (const tag of pageTags) {
        console.log(`  - ${tag}`);
      }
    }
  }
}
