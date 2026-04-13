# Research Skill

Use GBrain to conduct research across your personal knowledge base.

## Workflow

1. **Search for relevant information**
   ```bash
   gbrain search "topic"
   gbrain query "research question"
   ```

2. **Explore connections**
   ```bash
   gbrain backlinks <slug>
   gbrain link <from> <to>
   ```

3. **Capture findings**
   ```bash
   cat <<'EOF' | gbrain put research-topic
   ---
   type: concept
   title: Research Topic
   tags: [research]
   ---

   Compiled truth from research.

   ---

   Timeline of discoveries.
   EOF
   ```

4. **Track sources**
   ```bash
   gbrain timeline-add research-topic --date 2024-01-15 --summary "Found key insight" --source "source name"
   ```

## MCP Integration

When using AI assistants with GBrain MCP:

1. Use the `research_topic` prompt to explore a topic
2. Use `search_pages` tool to find relevant pages
3. Use `get_backlinks` to discover connections
4. Use `put_page` to capture new insights
5. Use `add_timeline_entry` to track progress

## Best Practices

- Use specific search terms for better results
- Link related pages to build a knowledge graph
- Add timeline entries to track research progress
- Tag pages by domain/topic for easy filtering
