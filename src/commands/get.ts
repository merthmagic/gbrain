import { BrainDB } from '../core/db.js';
import { renderPage } from '../core/markdown.js';

export default async function get(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing slug argument');
    console.error('Usage: gbrain get <slug>');
    process.exit(1);
  }

  const slug = args[0];
  const page = db.getPage(slug);

  if (!page) {
    console.error(`Error: Page not found: ${slug}`);
    process.exit(1);
  }

  if (flags.json) {
    console.log(JSON.stringify(page, null, 2));
  } else {
    console.log(renderPage(page));
  }
}
