import { BrainDB } from '../core/db.js';
import { searchFTS } from '../core/fts.js';

export default async function query(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing question argument');
    console.error('Usage: gbrain query <question> [--limit N]');
    process.exit(1);
  }

  const question = args.join(' ');
  const limit = flags.limit ? parseInt(flags.limit, 10) : undefined;

  // Currently, query uses only FTS5 search
  // In the future, this will combine FTS5 + vector search
  const results = searchFTS(db.getDatabase(), question, { limit });

  if (flags.json) {
    console.log(JSON.stringify({ question, results }, null, 2));
  } else {
    console.log(`Query results for "${question}":`);
    if (results.length === 0) {
      console.log('  (no results)');
      console.log('  Note: Vector search not yet implemented. Only FTS5 search is available.');
    } else {
      for (const result of results) {
        console.log(`  ${result.slug} (${result.type}) - score: ${result.score.toFixed(2)}`);
        console.log(`    ${result.snippet}`);
        console.log('');
      }
    }
  }
}
