import { BrainDB } from '../core/db.js';
import { generateEmbeddings, OllamaEmbeddingProvider } from '../core/embeddings.js';

export default async function embed(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  const provider = flags.provider || 'ollama';
  const model = flags.model || 'bge-m3';
  const baseUrl = flags.url || 'http://localhost:11434';
  const slug = args[0]; // Optional: generate embeddings for specific page
  const all = flags.all || flags['all-pages'];

  if (provider === 'ollama') {
    const ollamaProvider = new OllamaEmbeddingProvider(baseUrl, model);
    console.log(`Generating embeddings using Ollama (${model})...`);
    
    try {
      let count: number;
      if (slug) {
        count = await generateEmbeddings(db.getDatabase(), ollamaProvider, slug);
        console.log(`Generated ${count} embedding(s) for ${slug}`);
      } else if (all) {
        count = await generateEmbeddings(db.getDatabase(), ollamaProvider);
        console.log(`Generated ${count} embedding(s) for all pages`);
      } else {
        console.error('Error: Please specify --all to generate embeddings for all pages, or provide a slug');
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error generating embeddings: ${error}`);
      console.error('Make sure Ollama is running and the model is available');
      process.exit(1);
    }
  } else {
    console.error(`Error: Unknown provider: ${provider}`);
    console.error('Supported providers: ollama');
    process.exit(1);
  }
}
