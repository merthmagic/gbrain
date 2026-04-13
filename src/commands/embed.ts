import { BrainDB } from '../core/db.js';
import { generateEmbeddings } from '../core/embeddings.js';

export default async function embed(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  console.error('Error: Embedding generation not yet implemented');
  console.error('This command requires an embedding provider API key.');
  console.error('Please configure an embedding provider in a future version.');
  process.exit(1);
}
