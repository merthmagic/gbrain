import { BrainDB } from '../core/db.js';
import { parseMarkdown } from '../core/markdown.js';
import { extractLinks } from '../core/links.js';
import type { PageType } from '../core/types.js';
import * as fs from 'fs';
import * as path from 'path';

export default async function importCmd(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing directory argument');
    console.error('Usage: gbrain import <directory>');
    process.exit(1);
  }

  const dir = args[0];
  const dirPath = path.resolve(dir);

  if (!fs.existsSync(dirPath)) {
    console.error(`Error: Directory not found: ${dirPath}`);
    process.exit(1);
  }

  // Find all .md files recursively
  const markdownFiles: string[] = [];
  function walkDirectory(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walkDirectory(fullPath);
      } else if (entry.name.endsWith('.md')) {
        markdownFiles.push(fullPath);
      }
    }
  }
  walkDirectory(dirPath);

  if (markdownFiles.length === 0) {
    console.log('No markdown files found in directory.');
    return;
  }

  console.log(`Found ${markdownFiles.length} markdown file(s).`);

  let successCount = 0;
  let errorCount = 0;
  const pendingLinks: Array<{ fromSlug: string; toSlug: string; context: string }> = [];

  for (const filePath of markdownFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(dirPath, filePath);
      
      // Convert file path to slug (remove .md, use forward slashes)
      let slug = relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
      
      // Parse markdown
      const parsed = parseMarkdown(content);
      
      // Validate frontmatter
      const type = parsed.frontmatter.type as PageType;
      const title = parsed.frontmatter.title as string;
      
      if (!type || !title) {
        console.warn(`Skipping ${relativePath}: missing type or title in frontmatter`);
        errorCount++;
        continue;
      }
      
      // Write/update page
      const pageId = db.putPage(slug, {
        type,
        title,
        compiled_truth: parsed.compiledTruth,
        timeline: parsed.timeline,
        frontmatter: parsed.frontmatter,
      });
      
      // Extract links (create after all pages are imported)
      const links = extractLinks(content);
      for (const link of links) {
        pendingLinks.push({ fromSlug: slug, toSlug: link.targetSlug, context: link.context });
      }
      
      // Extract and add tags
      const tags = parsed.frontmatter.tags as string[] | undefined;
      if (tags && Array.isArray(tags)) {
        for (const tag of tags) {
          db.addTag(pageId, tag);
        }
      }
      
      // Store raw data for export
      db.setRawData(pageId, filePath, content);
      
      // Log ingest
      db.addIngestLog({ source_type: 'import', source_ref: filePath, pages_updated: [slug] });
      
      successCount++;
      if (!flags.json) {
        console.log(`  ✓ ${relativePath} -> ${slug}`);
      }
    } catch (error) {
      console.error(`  ✗ Error importing ${filePath}: ${error}`);
      errorCount++;
    }
  }

  let linksCreated = 0;
  let linksSkipped = 0;
  for (const link of pendingLinks) {
    try {
      db.addLink(link.fromSlug, link.toSlug, link.context);
      linksCreated++;
    } catch {
      linksSkipped++;
      if (!flags.json) {
        console.warn(`  Warning: Could not create link ${link.fromSlug} -> ${link.toSlug}`);
      }
    }
  }

  if (flags.json) {
    console.log(JSON.stringify({
      total: markdownFiles.length,
      success: successCount,
      errors: errorCount,
      links_created: linksCreated,
      links_skipped: linksSkipped,
    }, null, 2));
  } else {
    console.log(`\nImport complete: ${successCount} successful, ${errorCount} errors`);
    console.log(`Links: ${linksCreated} created, ${linksSkipped} skipped`);
  }
}
