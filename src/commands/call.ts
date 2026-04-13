import { BrainDB } from '../core/db.js';
import { MCPServer } from '../mcp/server.js';

export default async function call(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length < 2) {
    console.error('Error: Missing arguments');
    console.error('Usage: gbrain call <tool> <json>');
    console.error('Example: gbrain call get_stats "{}"');
    process.exit(1);
  }

  const toolName = args[0];
  const jsonInput = args.slice(1).join(' ');

  let toolArgs: Record<string, unknown>;
  try {
    const parsed = JSON.parse(jsonInput) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('Error: Tool arguments must be a JSON object');
      process.exit(1);
    }
    toolArgs = parsed as Record<string, unknown>;
  } catch (error) {
    console.error(`Error: Invalid JSON input: ${error}`);
    process.exit(1);
  }

  try {
    const server = new MCPServer(db);
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArgs,
      },
    });

    if (response.error) {
      console.error(`Error calling tool "${toolName}": ${response.error.message}`);
      process.exit(1);
    }

    if (flags.json) {
      console.log(JSON.stringify(response.result, null, 2));
      return;
    }

    const result = response.result as { content?: Array<{ type: string; text: string }> } | undefined;
    const content = result?.content || [];

    if (content.length === 0) {
      console.log(`Tool "${toolName}" executed successfully (no content returned).`);
      return;
    }

    for (const item of content) {
      if (item.type === 'text') {
        console.log(item.text);
      } else {
        console.log(JSON.stringify(item, null, 2));
      }
    }
  } catch (error) {
    console.error(`Error executing call command: ${error}`);
    process.exit(1);
  }
}
