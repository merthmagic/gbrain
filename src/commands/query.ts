import { BrainDB } from '../core/db.js';
import { searchFTS } from '../core/fts.js';
import { searchSemantic, OllamaEmbeddingProvider } from '../core/embeddings.js';

export default async function query(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing question argument');
    console.error('Usage: gbrain query <question> [--limit N] [--semantic]');
    process.exit(1);
  }

  const question = args.join(' ');
  const limit = flags.limit ? parseInt(flags.limit, 10) : undefined;
  const useSemantic = flags.semantic || flags['vector'];

  let results;
  if (useSemantic) {
    const provider = flags.provider || 'ollama';
    const model = flags.model || 'bge-m3';
    const baseUrl = flags.url || 'http://localhost:11434';

    if (provider === 'ollama') {
      try {
        const ollamaProvider = new OllamaEmbeddingProvider(baseUrl, model);
        results = await searchSemantic(db.getDatabase(), question, ollamaProvider, { limit });
      } catch (error) {
        console.error(`Error with semantic search: ${error}`);
        console.error('Falling back to FTS5 search...');
        results = searchFTS(db.getDatabase(), question, { limit });
      }
    } else {
      console.error(`Error: Unknown provider: ${provider}`);
      console.error('Falling back to FTS5 search...');
      results = searchFTS(db.getDatabase(), question, { limit });
    }
  } else {
    // Default: use FTS5 search
    results = searchFTS(db.getDatabase(), question, { limit });
  }

  if (flags.json) {
    console.log(JSON.stringify({ question, results, search_type: useSemantic ? 'semantic' : 'fts' }, null, 2));
  } else {
    console.log(`Query results for "${question}" (${useSemantic ? 'semantic' : 'FTS5'}):`);
    if (results.length === 0) {
      console.log('  (no results)');
      if (!useSemantic) {
        console.log('  Hint: Use --semantic for vector search (requires embeddings generated via embed --all)');
      }
    } else {
      for (const result of results) {
        console.log(`  ${result.slug} (${result.type}) - score: ${result.score.toFixed(2)}`);
        if (result.snippet) {
          console.log(`    ${result.snippet}`);
        }
        console.log('');
      }
    }
  }
}
