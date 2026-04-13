import { BrainDB } from '../core/db.js';
import { MCPServer } from '../mcp/server.js';

export default async function serve(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  const server = new MCPServer(db);
  await server.start();
}
