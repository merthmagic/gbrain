import { BrainDB } from '../core/db.js';
import { renderPage } from '../core/markdown.js';
import * as fs from 'fs';
import * as path from 'path';

export default async function exportCmd(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  const outputDir = flags.dir || flags['output-dir'] || './export';
  const dirPath = path.resolve(outputDir);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Get all pages
  const pages = db.listPages({});

  if (pages.length === 0) {
    console.log('No pages to export.');
    return;
  }

  console.log(`Exporting ${pages.length} page(s) to ${dirPath}`);

  let successCount = 0;
  let errorCount = 0;

  for (const page of pages) {
    try {
      // Try to get raw data first (from import)
      const rawData = db.getRawData(page.slug);
      let content: string;

      if (rawData && typeof rawData.data === 'string') {
        content = rawData.data;
      } else {
        // Render from database
        content = renderPage(page);
        // Store as raw data so import will work
        db.setRawData(page.id, 'export', content);
      }

      // Convert slug to file path
      const filePath = path.join(dirPath, `${page.slug}.md`);
      const fileDir = path.dirname(filePath);

      // Create subdirectories if needed
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(filePath, content, 'utf-8');

      successCount++;
      if (!flags.json) {
        console.log(`  ✓ ${page.slug}`);
      }
    } catch (error) {
      console.error(`  ✗ Error exporting ${page.slug}: ${error}`);
      errorCount++;
    }
  }

  if (flags.json) {
    console.log(JSON.stringify({
      total: pages.length,
      success: successCount,
      errors: errorCount,
      output_dir: dirPath,
    }, null, 2));
  } else {
    console.log(`\nExport complete: ${successCount} successful, ${errorCount} errors`);
    console.log(`Output directory: ${dirPath}`);
  }
}
