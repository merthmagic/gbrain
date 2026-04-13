import { BrainDB } from '../core/db.js';

export default async function tag(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length < 2) {
    console.error('Error: Missing arguments');
    console.error('Usage: gbrain tag <slug> <tag>');
    process.exit(1);
  }

  const slug = args[0];
  const tag = args[1];

  const page = db.getPage(slug);
  if (!page) {
    console.error(`Error: Page not found: ${slug}`);
    process.exit(1);
  }

  db.addTag(page.id, tag);

  if (flags.json) {
    console.log(JSON.stringify({ slug, tag, action: 'added' }, null, 2));
  } else {
    console.log(`Tag "${tag}" added to ${slug}`);
  }
}
