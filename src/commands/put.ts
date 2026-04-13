import { BrainDB } from '../core/db.js';
import { parseMarkdown } from '../core/markdown.js';
import { extractLinks } from '../core/links.js';
import type { PageType } from '../core/types.js';

export default async function put(args: string[], flags: Record<string, string>, db: BrainDB): Promise<void> {
  if (args.length === 0) {
    console.error('Error: Missing slug argument');
    console.error('Usage: gbrain put <slug> [< file.md]');
    process.exit(1);
  }

  const slug = args[0];

  // 从 stdin 读取内容
  let content = '';
  for await (const chunk of process.stdin) {
    content += chunk.toString();
  }

  if (!content.trim()) {
    console.error('Error: No content provided. Pipe markdown content via stdin.');
    process.exit(1);
  }

  // 解析 markdown
  const parsed = parseMarkdown(content);

  // 验证 frontmatter 包含必需字段
  const type = parsed.frontmatter.type as PageType;
  const title = parsed.frontmatter.title as string;

  if (!type) {
    console.error('Error: Missing required field "type" in frontmatter');
    process.exit(1);
  }

  if (!title) {
    console.error('Error: Missing required field "title" in frontmatter');
    process.exit(1);
  }

  // 写入/更新页面
  const pageId = db.putPage(slug, {
    type,
    title,
    compiled_truth: parsed.compiledTruth,
    timeline: parsed.timeline,
    frontmatter: parsed.frontmatter,
  });

  // 提取并创建链接
  const links = extractLinks(content);
  for (const link of links) {
    try {
      db.addLink(slug, link.targetSlug, link.context);
    } catch (error) {
      // 链接目标可能不存在，忽略错误
      console.warn(`Warning: Could not create link to ${link.targetSlug}: ${error}`);
    }
  }

  // 提取并添加标签
  const tags = parsed.frontmatter.tags as string[] | undefined;
  if (tags && Array.isArray(tags)) {
    for (const tag of tags) {
      db.addTag(pageId, tag);
    }
  }

  if (flags.json) {
    console.log(JSON.stringify({ slug, pageId, links: links.length, tags: tags?.length || 0 }, null, 2));
  } else {
    console.log(`Page "${slug}" ${pageId ? 'updated' : 'created'} successfully`);
    console.log(`  Links: ${links.length}`);
    console.log(`  Tags: ${tags?.length || 0}`);
  }
}
