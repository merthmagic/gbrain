import { BrainDB } from '../core/db.js';
import { renderPage } from '../core/markdown.js';
import { searchFTS } from '../core/fts.js';
import type { PageType } from '../core/types.js';

// MCP Protocol Types
interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export class MCPServer {
  private db: BrainDB;
  private tools: MCPTool[];
  private resources: MCPResource[];
  private prompts: MCPPrompt[];

  constructor(db: BrainDB) {
    this.db = db;
    this.tools = this.registerTools();
    this.resources = this.registerResources();
    this.prompts = this.registerPrompts();
  }

  private registerTools(): MCPTool[] {
    return [
      {
        name: 'get_page',
        description: 'Get a page by slug',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Page slug' },
          },
          required: ['slug'],
        },
      },
      {
        name: 'put_page',
        description: 'Create or update a page',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Page slug' },
            type: { type: 'string', description: 'Page type (person, company, project, concept, note)' },
            title: { type: 'string', description: 'Page title' },
            compiled_truth: { type: 'string', description: 'Compiled truth content' },
            timeline: { type: 'string', description: 'Timeline content (optional)' },
            frontmatter: { type: 'object', description: 'Frontmatter metadata' },
          },
          required: ['slug', 'type', 'title', 'compiled_truth'],
        },
      },
      {
        name: 'search_pages',
        description: 'Search pages using full-text search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            type: { type: 'string', description: 'Filter by page type (optional)' },
            limit: { type: 'number', description: 'Maximum results (default 20)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_pages',
        description: 'List all pages with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Filter by page type (optional)' },
            tag: { type: 'string', description: 'Filter by tag (optional)' },
            limit: { type: 'number', description: 'Maximum results' },
            offset: { type: 'number', description: 'Offset for pagination' },
          },
        },
      },
      {
        name: 'get_tags',
        description: 'Get tags for a page',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Page slug' },
          },
          required: ['slug'],
        },
      },
      {
        name: 'add_tag',
        description: 'Add a tag to a page',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Page slug' },
            tag: { type: 'string', description: 'Tag to add' },
          },
          required: ['slug', 'tag'],
        },
      },
      {
        name: 'get_backlinks',
        description: 'Get pages that link to a given page',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Page slug' },
          },
          required: ['slug'],
        },
      },
      {
        name: 'get_timeline',
        description: 'Get timeline entries for a page',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Page slug' },
            limit: { type: 'number', description: 'Maximum entries' },
          },
          required: ['slug'],
        },
      },
      {
        name: 'add_timeline_entry',
        description: 'Add a timeline entry to a page',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Page slug' },
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            source: { type: 'string', description: 'Source (optional)' },
            summary: { type: 'string', description: 'Summary' },
            detail: { type: 'string', description: 'Detail (optional)' },
          },
          required: ['slug', 'date', 'summary'],
        },
      },
      {
        name: 'get_stats',
        description: 'Get brain statistics',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  private registerResources(): MCPResource[] {
    const pages = this.db.listPages({});
    return pages.map(page => ({
      uri: `gbrain://pages/${page.slug}`,
      name: page.title,
      description: `${page.type}: ${page.slug}`,
      mimeType: 'text/markdown',
    }));
  }

  private registerPrompts(): MCPPrompt[] {
    return [
      {
        name: 'summarize_page',
        description: 'Summarize a page',
        arguments: [
          { name: 'slug', description: 'Page slug', required: true },
        ],
      },
      {
        name: 'explore_connections',
        description: 'Explore connections between pages',
        arguments: [
          { name: 'slug', description: 'Starting page slug', required: true },
        ],
      },
      {
        name: 'research_topic',
        description: 'Research a topic across all pages',
        arguments: [
          { name: 'topic', description: 'Topic to research', required: true },
        ],
      },
    ];
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
    };

    try {
      switch (request.method) {
        case 'initialize':
          response.result = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
            serverInfo: {
              name: 'gbrain',
              version: '0.1.0',
            },
          };
          break;

        case 'tools/list':
          response.result = { tools: this.tools };
          break;

        case 'tools/call':
          response.result = await this.handleToolCall(request.params);
          break;

        case 'resources/list':
          response.result = { resources: this.registerResources() };
          break;

        case 'resources/read':
          response.result = await this.handleResourceRead(request.params);
          break;

        case 'prompts/list':
          response.result = { prompts: this.prompts };
          break;

        case 'prompts/get':
          response.result = await this.handlePromptGet(request.params);
          break;

        default:
          response.error = {
            code: -32601,
            message: `Method not found: ${request.method}`,
          };
      }
    } catch (error) {
      response.error = {
        code: -32603,
        message: `Internal error: ${error}`,
      };
    }

    return response;
  }

  private async handleToolCall(params: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    const p = params as { name: string; arguments: Record<string, unknown> };
    const toolName = p.name;
    const args = p.arguments;

    switch (toolName) {
      case 'get_page': {
        const slug = args.slug as string;
        const page = this.db.getPage(slug);
        if (!page) {
          throw new Error(`Page not found: ${slug}`);
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(page, null, 2) }],
        };
      }

      case 'put_page': {
        const slug = args.slug as string;
        const pageId = this.db.putPage(slug, {
          type: args.type as PageType,
          title: args.title as string,
          compiled_truth: args.compiled_truth as string,
          timeline: (args.timeline as string) || '',
          frontmatter: (args.frontmatter as Record<string, unknown>) || {},
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ slug, pageId }, null, 2) }],
        };
      }

      case 'search_pages': {
        const query = args.query as string;
        const type = args.type as string | undefined;
        const limit = args.limit as number | undefined;
        const results = searchFTS(this.db.getDatabase(), query, { type, limit });
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'list_pages': {
        const type = args.type as string | undefined;
        const tag = args.tag as string | undefined;
        const limit = args.limit as number | undefined;
        const offset = args.offset as number | undefined;
        const pages = this.db.listPages({ type, tag, limit, offset });
        return {
          content: [{ type: 'text', text: JSON.stringify(pages, null, 2) }],
        };
      }

      case 'get_tags': {
        const slug = args.slug as string;
        const tags = this.db.getTags(slug);
        return {
          content: [{ type: 'text', text: JSON.stringify({ slug, tags }, null, 2) }],
        };
      }

      case 'add_tag': {
        const slug = args.slug as string;
        const tag = args.tag as string;
        const page = this.db.getPage(slug);
        if (!page) {
          throw new Error(`Page not found: ${slug}`);
        }
        this.db.addTag(page.id, tag);
        return {
          content: [{ type: 'text', text: JSON.stringify({ slug, tag, action: 'added' }, null, 2) }],
        };
      }

      case 'get_backlinks': {
        const slug = args.slug as string;
        const backlinks = this.db.getBacklinks(slug);
        return {
          content: [{ type: 'text', text: JSON.stringify({ slug, backlinks }, null, 2) }],
        };
      }

      case 'get_timeline': {
        const slug = args.slug as string;
        const limit = args.limit as number | undefined;
        const timeline = this.db.getTimeline(slug, limit);
        return {
          content: [{ type: 'text', text: JSON.stringify({ slug, timeline }, null, 2) }],
        };
      }

      case 'add_timeline_entry': {
        const slug = args.slug as string;
        const page = this.db.getPage(slug);
        if (!page) {
          throw new Error(`Page not found: ${slug}`);
        }
        this.db.addTimelineEntry(page.id, {
          date: args.date as string,
          source: (args.source as string) || '',
          summary: args.summary as string,
          detail: (args.detail as string) || '',
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ slug, action: 'added' }, null, 2) }],
        };
      }

      case 'get_stats': {
        const stats = this.db.getStats();
        return {
          content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async handleResourceRead(params: unknown): Promise<{ uri: string; mimeType: string; text: string }> {
    const p = params as { uri: string };
    const uri = p.uri;

    if (!uri.startsWith('gbrain://pages/')) {
      throw new Error(`Invalid URI: ${uri}`);
    }

    const slug = uri.replace('gbrain://pages/', '');
    const page = this.db.getPage(slug);

    if (!page) {
      throw new Error(`Page not found: ${slug}`);
    }

    const rawData = this.db.getRawData(slug);
    let content: string;

    if (rawData && typeof rawData.data === 'string') {
      content = rawData.data;
    } else {
      content = renderPage(page);
    }

    return {
      uri,
      mimeType: 'text/markdown',
      text: content,
    };
  }

  private async handlePromptGet(params: unknown): Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
    const p = params as { name: string; arguments: Record<string, unknown> };
    const promptName = p.name;
    const args = p.arguments;

    switch (promptName) {
      case 'summarize_page': {
        const slug = args.slug as string;
        const page = this.db.getPage(slug);
        if (!page) {
          throw new Error(`Page not found: ${slug}`);
        }
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please summarize the following page:\n\nTitle: ${page.title}\nType: ${page.type}\n\nContent:\n${page.compiled_truth}`,
              },
            },
          ],
        };
      }

      case 'explore_connections': {
        const slug = args.slug as string;
        const page = this.db.getPage(slug);
        if (!page) {
          throw new Error(`Page not found: ${slug}`);
        }
        const backlinks = this.db.getBacklinks(slug);
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Explore connections for "${page.title}" (${page.slug}).\n\nPages linking to this page:\n${backlinks.map(p => `- ${p.title} (${p.slug})`).join('\n')}\n\nAnalyze the relationships and provide insights.`,
              },
            },
          ],
        };
      }

      case 'research_topic': {
        const topic = args.topic as string;
        const results = searchFTS(this.db.getDatabase(), topic, { limit: 10 });
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Research the topic: "${topic}"\n\nRelevant pages found:\n${results.map(r => `- ${r.title} (${r.slug}): ${r.snippet}`).join('\n')}\n\nProvide a comprehensive analysis based on these pages.`,
              },
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown prompt: ${promptName}`);
    }
  }

  async start(): Promise<void> {
    const stdin = Bun.stdin.stream();
    const reader = stdin.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const line = new TextDecoder().decode(value).trim();
        if (!line) continue;

        const request = JSON.parse(line) as MCPRequest;
        const response = await this.handleRequest(request);

        const responseText = JSON.stringify(response) + '\n';
        await Bun.write(Bun.stdout, responseText);
      }
    } finally {
      reader.releaseLock();
      this.db.close();
    }
  }
}
