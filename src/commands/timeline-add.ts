import { BrainDB } from '../core/db.js';

export default async function timelineAdd(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing slug argument');
    console.error('Usage: gbrain timeline-add <slug> --date <YYYY-MM-DD> --summary "..." [--source "..."] [--detail "..."]');
    process.exit(1);
  }

  const slug = args[0];
  const date = flags.date;
  const summary = flags.summary;
  const source = flags.source || '';
  const detail = flags.detail || '';

  if (!date) {
    console.error('Error: Missing --date flag');
    process.exit(1);
  }

  if (!summary) {
    console.error('Error: Missing --summary flag');
    process.exit(1);
  }

  const page = db.getPage(slug);
  if (!page) {
    console.error(`Error: Page not found: ${slug}`);
    process.exit(1);
  }

  db.addTimelineEntry(page.id, { date, source, summary, detail });

  if (flags.json) {
    console.log(JSON.stringify({ slug, date, summary, source, detail, action: 'added' }, null, 2));
  } else {
    console.log(`Timeline entry added to ${slug}: ${date} - ${summary}`);
  }
}
