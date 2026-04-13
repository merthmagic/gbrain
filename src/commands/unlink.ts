import { BrainDB } from '../core/db.js';

export default async function unlink(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length < 2) {
    console.error('Error: Missing arguments');
    console.error('Usage: gbrain unlink <from-slug> <to-slug>');
    process.exit(1);
  }

  const fromSlug = args[0];
  const toSlug = args[1];

  db.removeLink(fromSlug, toSlug);

  if (flags.json) {
    console.log(JSON.stringify({ from: fromSlug, to: toSlug, action: 'unlinked' }, null, 2));
  } else {
    console.log(`Unlinked ${fromSlug} -> ${toSlug}`);
  }
}
