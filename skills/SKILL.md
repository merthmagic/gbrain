# GBrain CLI

A personal knowledge management CLI built with Bun + TypeScript + SQLite.

## Quick Start

```bash
# Initialize a new brain
gbrain init ./brain.db

# Create a page
cat <<'EOF' | gbrain put my-page
---
type: note
title: My First Page
tags: [test, example]
---

This is the compiled truth section.

---

This is the timeline section.
EOF

# Read a page
gbrain get my-page

# Search
gbrain search "query"

# List pages
gbrain list

# Get statistics
gbrain stats
```

## Commands

### Page Management
- `init [path]` - Create a new brain database
- `get <slug>` - Read a page
- `put <slug>` - Write/update a page (pipe markdown via stdin)
- `list [--type] [--tag]` - List pages
- `delete <slug>` - Delete a page

### Tags
- `tags <slug>` - List tags for a page
- `tag <slug> <tag>` - Add a tag
- `untag <slug> <tag>` - Remove a tag

### Links
- `link <from> <to> [--context "..."]` - Create a link
- `unlink <from> <to>` - Remove a link
- `backlinks <slug>` - Show backlinks

### Timeline
- `timeline <slug>` - Show timeline
- `timeline-add <slug> --date <YYYY-MM-DD> --summary "..."` - Add timeline entry

### Search
- `search <query>` - Full-text search
- `query <question>` - Hybrid search (FTS5 only for now)

### Import/Export
- `import <directory>` - Import from markdown directory
- `export [--dir <path>]` - Export to markdown

### MCP Server
- `serve` - Start MCP stdio server for AI integration

### Configuration
- `config [key] [value]` - Get/set configuration

## Global Flags
- `--db <path>` - Specify database path
- `--json` - Output as JSON

## Page Format

Pages use markdown with YAML frontmatter:

```markdown
---
type: person|company|project|concept|note
title: Page Title
tags: [tag1, tag2]
custom_field: value
---

Compiled truth content (main content).

---

Timeline entries (optional).
```

## MCP Integration

GBrain supports the Model Context Protocol (MCP) for AI assistant integration:

```bash
# Start MCP server
gbrain serve
```

The MCP server exposes tools for:
- Reading/writing pages
- Searching
- Managing tags and links
- Accessing timeline entries
- Getting statistics
