# GBrain Project

A personal knowledge management CLI built with Bun + TypeScript + SQLite.

## Project Structure

```
gbrain/
├── src/
│   ├── cli.ts              # CLI entry point with argument parsing
│   ├── core/
│   │   ├── types.ts        # TypeScript interfaces
│   │   ├── db.ts           # Database connection and CRUD
│   │   ├── markdown.ts     # Markdown parsing and rendering
│   │   ├── links.ts        # Link extraction and resolution
│   │   ├── fts.ts          # FTS5 full-text search
│   │   └── embeddings.ts   # Embedding interface (placeholder)
│   ├── commands/
│   │   ├── init.ts         # Initialize brain
│   │   ├── get.ts          # Get page
│   │   ├── put.ts          # Put page
│   │   ├── list.ts         # List pages
│   │   ├── stats.ts        # Statistics
│   │   ├── tags.ts         # List tags
│   │   ├── tag.ts          # Add tag
│   │   ├── untag.ts        # Remove tag
│   │   ├── link.ts         # Create link
│   │   ├── unlink.ts       # Remove link
│   │   ├── backlinks.ts    # Get backlinks
│   │   ├── timeline.ts     # Get timeline
│   │   ├── timeline-add.ts # Add timeline entry
│   │   ├── search.ts       # Search
│   │   ├── query.ts        # Hybrid search
│   │   ├── embed.ts        # Generate embeddings (placeholder)
│   │   ├── import.ts       # Import from markdown
│   │   ├── export.ts       # Export to markdown
│   │   ├── config.ts       # Configuration
│   │   ├── serve.ts        # MCP server
│   │   └── call.ts         # Raw tool call (placeholder)
│   └── mcp/
│       └── server.ts       # MCP stdio server
├── skills/
│   ├── SKILL.md            # Main skill documentation
│   ├── RESEARCH.md         # Research workflow
│   ├── NOTE-TAKING.md      # Note-taking workflow
│   ├── KNOWLEDGE-GRAPH.md  # Knowledge graph workflow
│   └── MCP-INTEGRATION.md # MCP integration guide
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Architecture

### Core Components

- **BrainDB**: SQLite database with WAL mode, handles all CRUD operations
- **Markdown Parser**: Extracts frontmatter, splits content into compiled_truth and timeline
- **Link Extractor**: Finds wiki-style markdown links and resolves slugs
- **FTS5 Search**: Full-text search using SQLite FTS5 extension
- **MCP Server**: Model Context Protocol stdio server for AI integration

### Page Model

Pages have:
- `slug`: Unique identifier (e.g., "people/john-doe")
- `type`: person, company, project, concept, or note
- `title`: Display title
- `compiled_truth`: Main content
- `timeline`: Chronological entries
- `frontmatter`: YAML metadata
- `tags`: Optional tags
- `links`: Connections to other pages

### Data Flow

**Import**: Markdown files → Parse → Extract links/tags → Store in DB
**Export**: DB pages → Render markdown → Write to files
**Search**: Query → FTS5 search → Return ranked results
**MCP**: JSON-RPC over stdio → Tool calls → DB operations → JSON response

## Key Design Decisions

1. **SQLite over other databases**: Fast, embedded, no setup, FTS5 built-in
2. **Markdown-native**: Easy to edit, version control friendly
3. **CLI-first**: Scriptable, composable, works with existing tools
4. **MCP integration**: AI-ready via standard protocol
5. **WAL mode**: Better concurrency, performance
6. **TypeScript**: Type safety, better IDE support

## Usage Examples

```bash
# Initialize
gbrain init ./brain.db

# Create page
cat <<'EOF' | gbrain put my-page
---
type: note
title: My Page
tags: [test]
---

Content here.
EOF

# Read page
gbrain get my-page

# Search
gbrain search "query"

# List
gbrain list --type person

# Import/Export
gbrain import ./notes
gbrain export --dir ./output

# MCP server
gbrain serve
```

## MCP Tools

The MCP server exposes these tools:
- `get_page`, `put_page`, `list_pages`, `search_pages`
- `get_tags`, `add_tag`
- `get_backlinks`
- `get_timeline`, `add_timeline_entry`
- `get_stats`

## Development

```bash
# Install dependencies
bun install

# Run
bun run src/cli.ts <command>

# Build
bun build src/cli.ts --outdir dist --target bun

# Compile binary
bun build --compile --outfile bin/gbrain src/cli.ts
```

## Testing

Test the basic workflow:
1. `gbrain init ./test.db`
2. Create a test page via `put`
3. Read it back via `get`
4. Search via `search`
5. List via `list`
6. Export via `export`
7. Verify round-trip import/export

## Future Enhancements

- Vector embeddings for semantic search
- Web UI (optional)
- Sync with cloud storage
- More export formats (JSON, HTML)
- Advanced query language
