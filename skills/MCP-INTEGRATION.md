# MCP Integration Skill

Use GBrain with AI assistants via the Model Context Protocol.

## Setup

### Start MCP Server
```bash
gbrain serve --db ./brain.db
```

### Configure AI Assistant

Add to your AI assistant's MCP configuration:

```json
{
  "mcpServers": {
    "gbrain": {
      "command": "gbrain",
      "args": ["serve", "--db", "./brain.db"]
    }
  }
}
```

## Available Tools

### Page Management
- `get_page` - Read a page by slug
- `put_page` - Create or update a page
- `list_pages` - List pages with filters
- `search_pages` - Full-text search

### Tags
- `get_tags` - Get tags for a page
- `add_tag` - Add a tag to a page

### Links
- `get_backlinks` - Get pages linking to a page

### Timeline
- `get_timeline` - Get timeline entries
- `add_timeline_entry` - Add a timeline entry

### Stats
- `get_stats` - Get brain statistics

## Available Resources

All pages are available as resources at `gbrain://pages/{slug}`.

## Available Prompts

### `summarize_page`
Summarize a page for quick understanding.

### `explore_connections`
Explore connections starting from a page.

### `research_topic`
Research a topic across all pages.

## Example Workflows

### Research Assistant
```
AI: "What do you know about [topic]?"
→ Uses search_pages tool
→ Reads relevant pages via resources
→ Summarizes findings
```

### Knowledge Builder
```
AI: "Create a page about [subject]"
→ Uses put_page tool
→ Suggests tags
→ Suggests links to related pages
```

### Connection Finder
```
AI: "How is [A] related to [B]?"
→ Uses get_backlinks tool
→ Explores intermediate connections
→ Provides relationship summary
```

## Best Practices

1. **Provide context** - Tell the AI what you're researching
2. **Iterate** - Use search results to refine queries
3. **Capture insights** - Ask the AI to put_page when it finds useful info
4. **Build connections** - Ask the AI to link related pages
5. **Review** - Check AI-generated content before saving

## Common Patterns

### Literature Review
```
1. Search for topic
2. Read relevant pages
3. Ask AI to summarize and find gaps
4. Create new page with synthesis
5. Link to sources
```

### Meeting Preparation
```
1. Search for person/company
2. Review timeline entries
3. Check backlinks for recent activity
4. Prepare talking points
```

### Project Tracking
```
1. Get project page
2. Review timeline
3. Check linked pages (team, dependencies)
4. Update status
```
