import { BrainDB } from '../core/db.js';

export default async function link(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length < 2) {
    console.error('Error: Missing arguments');
    console.error('Usage: gbrain link <from-slug> <to-slug> [--context "..."]');
    process.exit(1);
  }

  const fromSlug = args[0];
  const toSlug = args[1];
  const context = flags.context || '';

  try {
    db.addLink(fromSlug, toSlug, context);
    
    if (flags.json) {
      console.log(JSON.stringify({ from: fromSlug, to: toSlug, context, action: 'linked' }, null, 2));
    } else {
      console.log(`Linked ${fromSlug} -> ${toSlug}`);
    }
  } catch (error) {
    console.error(`Error creating link: ${error}`);
    process.exit(1);
  }
}
