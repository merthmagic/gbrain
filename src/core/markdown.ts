import matter from 'gray-matter';
import YAML from 'yaml';
import type { Page } from './types';

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  compiledTruth: string;
  timeline: string;
}

export function parseMarkdown(content: string): ParsedMarkdown {
  // 使用 gray-matter 解析 frontmatter
  const { data, content: body } = matter(content);

  // 查找第一个水平线 --- 来拆分 compiled_truth 和 timeline
  const separatorIndex = body.indexOf('\n---\n');
  
  if (separatorIndex === -1) {
    // 没有分隔线，全部作为 compiled_truth
    return {
      frontmatter: data as Record<string, unknown>,
      compiledTruth: body.trim(),
      timeline: '',
    };
  }

  const compiledTruth = body.slice(0, separatorIndex).trim();
  const timeline = body.slice(separatorIndex + 5).trim();

  return {
    frontmatter: data as Record<string, unknown>,
    compiledTruth,
    timeline,
  };
}

export function renderPage(page: Page): string {
  // frontmatter → YAML
  const frontmatterYAML = YAML.stringify(page.frontmatter);
  
  // 组合为完整 markdown
  let output = '';
  
  if (frontmatterYAML && frontmatterYAML !== '{}\n') {
    output += '---\n';
    output += frontmatterYAML;
    output += '---\n\n';
  }
  
  output += page.compiled_truth;
  
  if (page.timeline) {
    output += '\n\n---\n\n';
    output += page.timeline;
  }
  
  return output;
}
