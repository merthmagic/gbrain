import { BrainDB } from '../core/db.js';
import { MCPServer } from '../mcp/server.js';

export default async function serve(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  console.error('gbrain MCP server starting...');
  const server = new MCPServer(db);
  console.error('gbrain MCP server started, listening on stdin/stdout');
  await server.start();
}
