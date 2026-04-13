# Note-Taking Skill

Capture and organize your thoughts with GBrain.

## Quick Capture

```bash
# Quick note capture
cat <<'EOF' | gbrain put $(date +%Y-%m-%d)-note
---
type: note
title: Quick Note
tags: [inbox]
---

Quick thought or observation.
EOF
```

## Organizing Notes

### By Type
- `person` - People, contacts
- `company` - Companies, organizations
- `project` - Projects, initiatives
- `concept` - Ideas, concepts
- `note` - General notes

### By Tags
```bash
# Tag for context
gbrain tag my-page important

# Find by tag
gbrain list --tag important
```

### By Links
```bash
# Connect related notes
gbrain link note-a note-b --context "Related to"

# Find connections
gbrain backlinks note-b
```

## Daily Workflow

1. **Morning review**
   ```bash
   gbrain list --limit 10
   gbrain timeline $(date +%Y-%m-%d)
   ```

2. **Capture throughout day**
   ```bash
   gbrain put $(date +%Y-%m-%d)-$(date +%H%M)-note < file.md
   ```

3. **Evening synthesis**
   ```bash
   gbrain timeline-add daily-log --date $(date +%Y-%m-%d) --summary "Day summary"
   ```

## Templates

### Meeting Note
```markdown
---
type: note
title: Meeting - [Topic]
tags: [meeting]
---

**Attendees:**
- Person A
- Person B

**Agenda:**
1. Item 1
2. Item 2

**Decisions:**
- Decision 1
- Decision 2

**Action Items:**
- [ ] Task 1
- [ ] Task 2
```

### Project Note
```markdown
---
type: project
title: [Project Name]
tags: [project, active]
---

**Status:** In Progress

**Goals:**
- Goal 1
- Goal 2

**Progress:**
- Completed: X
- Remaining: Y

**Blockers:**
- Issue 1
```
