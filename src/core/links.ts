export interface ExtractedLink {
  displayText: string;
  targetSlug: string;
  context: string;
}

// 匹配模式: [Display Text](../people/name.md) 或 [Display Text](people/name.md)
const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export function extractLinks(markdown: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;

    // 重置正则表达式的 lastIndex
    LINK_PATTERN.lastIndex = 0;

    while ((match = LINK_PATTERN.exec(line)) !== null) {
      const displayText = match[1];
      const targetPath = match[2];

      // 只处理相对路径的 markdown 链接（以 .md 结尾）
      if (targetPath.endsWith('.md')) {
        const targetSlug = resolveSlug(targetPath);

        // 获取上下文（当前行）
        const context = line.trim();

        links.push({
          displayText,
          targetSlug,
          context,
        });
      }
    }
  }

  return links;
}

export function resolveSlug(slug: string): string {
  // 移除 .md 后缀
  let resolved = slug.replace(/\.md$/, '');

  // 处理相对路径 ../
  resolved = resolved.replace(/^\.\.\//, '');

  // 标准化路径分隔符
  resolved = resolved.replace(/\\/g, '/');

  return resolved;
}
