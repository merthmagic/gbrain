# gbrain

A local knowledge base CLI built with Bun + TypeScript + SQLite.

## Features

- Markdown pages with YAML frontmatter
- Tags and bidirectional links (backlinks)
- Timeline entries per page
- Full-text search (SQLite FTS5)
- Optional semantic search (Ollama embeddings)
- Markdown directory import/export
- MCP server for AI agent integration

## Install

```bash
# From source
git clone <repo> && cd gbrain && bun install

# From npm (requires Bun runtime)
npm i -g gbrain

# Pre-built binaries: see GitHub Releases
```

## Quick Start

```bash
# Initialize
gbrain init ./brain.db

# Create a page
cat <<'EOF' | gbrain put people/alice
---
type: person
title: Alice Zhang
tags: [founder, ai]
---

Alice founded Acme AI in 2025.
EOF

# Link pages
gbrain link people/alice companies/acme-ai --context "founder"

# Search & query
gbrain search "copilot"
gbrain backlinks companies/acme-ai

# Import / export
gbrain import ./notes
gbrain export --dir ./output
```

## Page Format

```markdown
---
type: person
title: Alice Zhang
tags: [founder, ai]
---

Main content (compiled truth).

---

2026-04-10 Joined YC.
```

Supported types: `person`, `company`, `deal`, `yc`, `civic`, `project`, `concept`, `source`, `media`.

## Commands

| Category | Commands |
|----------|----------|
| Pages | `init`, `get`, `put`, `list`, `stats` |
| Tags | `tags`, `tag`, `untag` |
| Links | `link`, `unlink`, `backlinks` |
| Timeline | `timeline`, `timeline-add` |
| Search | `search`, `query`, `embed` |
| Data | `import`, `export` |
| MCP | `serve`, `call`, `config` |

Global flags: `--db <path>`, `--json`

## MCP Server

```bash
gbrain serve
```

Exposes tools: `get_page`, `put_page`, `list_pages`, `search_pages`, `get_tags`, `add_tag`, `get_backlinks`, `get_timeline`, `add_timeline_entry`, `get_stats`.

## License

MIT
