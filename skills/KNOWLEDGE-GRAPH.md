# Knowledge Graph Skill

Build and navigate a knowledge graph with GBrain.

## Building the Graph

### Create Pages
```bash
# Create entities
gbrain put person/john-doe < person.md
gbrain put company/acme < company.md
gbrain put project/website < project.md
```

### Link Entities
```bash
# Person works at company
gbrain link person/john-doe company/acme --context "Works at"

# Person contributes to project
gbrain link person/john-doe project/website --context "Lead developer"

- Company owns project
gbrain link company/acme project/website --context "Client"
```

### Discover Connections
```bash
# Find who links to a page
gbrain backlinks company/acme

# Explore a node's neighborhood
gbrain get company/acme
gbrain backlinks company/acme
```

## Navigation Patterns

### Follow the Links
1. Start with a person or company
2. Use `backlinks` to find related entities
3. Use `link` to create new connections
4. Build a web of interconnected knowledge

### Tag-Based Clusters
```bash
# Tag by domain
gbrain tag person/john-doe engineering
gbrain tag project/website frontend

# Find clusters
gbrain list --tag engineering
gbrain list --tag frontend
```

## Graph Queries

### Find All People at a Company
```bash
gbrain search "works at Acme"
# Or manually check backlinks
gbrain backlinks company/acme
```

### Find All Projects for a Person
```bash
gbrain backlinks person/john-doe
# Filter by type: project
```

### Find Related Concepts
```bash
gbrain search "concept"
# Check backlinks for each result
```

## Visualization Tips

- Use descriptive link contexts to explain relationships
- Tag entities by domain for clustering
- Use timeline to track relationship changes
- Export to markdown to visualize with external tools

## Maintenance

### Audit Links
```bash
# List all pages
gbrain list

# Check each page's backlinks
for slug in $(gbrain list --json | jq -r '.[].slug'); do
  gbrain backlinks $slug
done
```

### Clean Up
```bash
# Remove broken links
gbrain unlink <from> <to>

# Merge duplicate pages
# Manually export, merge, and re-import
```
