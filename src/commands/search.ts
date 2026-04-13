import { BrainDB } from '../core/db.js';
import { searchFTS } from '../core/fts.js';

export default async function search(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing query argument');
    console.error('Usage: gbrain search <query> [--type <type>] [--limit N]');
    process.exit(1);
  }

  const query = args.join(' ');
  const type = flags.type;
  const limit = flags.limit ? parseInt(flags.limit, 10) : undefined;

  const results = searchFTS(db.getDatabase(), query, { type, limit });

  if (flags.json) {
    console.log(JSON.stringify({ query, results }, null, 2));
  } else {
    console.log(`Search results for "${query}":`);
    if (results.length === 0) {
      console.log('  (no results)');
    } else {
      for (const result of results) {
        console.log(`  ${result.slug} (${result.type}) - score: ${result.score.toFixed(2)}`);
        console.log(`    ${result.snippet}`);
        console.log('');
      }
    }
  }
}
