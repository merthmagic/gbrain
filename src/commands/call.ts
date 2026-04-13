import { BrainDB } from '../core/db.js';

export default async function call(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  console.error('Error: Raw tool call not yet implemented');
  console.error('This command allows direct tool calls to the MCP server.');
  console.error('Please implement the MCP server first.');
  process.exit(1);
}
