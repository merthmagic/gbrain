import { BrainDB } from '../core/db.js';

export default async function stats(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  const stats = db.getStats();

  if (flags.json) {
    console.log(JSON.stringify(stats, null, 2));
  } else {
    console.log('Brain Statistics:');
    console.log('');
    console.log(`  Pages: ${stats.pages.total}`);
    for (const [type, count] of Object.entries(stats.pages.by_type)) {
      console.log(`    ${type}: ${count}`);
    }
    console.log(`  Links: ${stats.links}`);
    console.log(`  Tags: ${stats.tags}`);
    console.log(`  Timeline Entries: ${stats.timeline_entries}`);
    console.log(`  Raw Data: ${stats.raw_data}`);
    console.log(`  Embeddings: ${stats.embeddings}`);
    console.log(`  Database Size: ${(stats.db_size_bytes / 1024 / 1024).toFixed(2)} MB`);
  }
}
