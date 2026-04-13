import { describe, test, expect } from 'bun:test';
import { extractLinks, resolveSlug } from '../src/core/links';

describe('extractLinks', () => {
  test('extracts simple .md links', () => {
    const markdown = 'See [Alice](people/alice.md) for details.';
    const links = extractLinks(markdown);

    expect(links).toHaveLength(1);
    expect(links[0].displayText).toBe('Alice');
    expect(links[0].targetSlug).toBe('people/alice');
    expect(links[0].context).toBe('See [Alice](people/alice.md) for details.');
  });

  test('extracts relative path links with ../', () => {
    const markdown = 'Related to [John](../people/john-doe.md).';
    const links = extractLinks(markdown);

    expect(links).toHaveLength(1);
    expect(links[0].displayText).toBe('John');
    expect(links[0].targetSlug).toBe('people/john-doe');
  });

  test('extracts multiple links from one line', () => {
    const markdown = '[Alice](people/alice.md) and [Bob](people/bob.md) worked together.';
    const links = extractLinks(markdown);

    expect(links).toHaveLength(2);
    expect(links[0].targetSlug).toBe('people/alice');
    expect(links[1].targetSlug).toBe('people/bob');
  });

  test('extracts links across multiple lines', () => {
    const markdown = `See [Alice](people/alice.md).
Also check [Acme](companies/acme-ai.md).`;

    const links = extractLinks(markdown);

    expect(links).toHaveLength(2);
    expect(links[0].targetSlug).toBe('people/alice');
    expect(links[1].targetSlug).toBe('companies/acme-ai');
  });

  test('ignores http links', () => {
    const markdown = 'Visit [Google](https://google.com) for search.';
    const links = extractLinks(markdown);

    expect(links).toHaveLength(0);
  });

  test('ignores non-markdown relative links', () => {
    const markdown = 'See [image](./assets/logo.png) and [doc](./files/readme.txt).';
    const links = extractLinks(markdown);

    expect(links).toHaveLength(0);
  });

  test('returns empty array for no links', () => {
    const links = extractLinks('Just plain text with no links.');
    expect(links).toHaveLength(0);
  });

  test('returns empty array for empty string', () => {
    const links = extractLinks('');
    expect(links).toHaveLength(0);
  });

  test('handles link with display text containing special chars', () => {
    const markdown = 'Check [O\'Brien & Co.](companies/obrien.md) profile.';
    const links = extractLinks(markdown);

    expect(links).toHaveLength(1);
    expect(links[0].displayText).toBe('O\'Brien & Co.');
    expect(links[0].targetSlug).toBe('companies/obrien');
  });
});

describe('resolveSlug', () => {
  test('removes .md extension', () => {
    expect(resolveSlug('people/alice.md')).toBe('people/alice');
  });

  test('removes leading ../', () => {
    expect(resolveSlug('../people/john.md')).toBe('people/john');
  });

  test('handles both ../ and .md', () => {
    expect(resolveSlug('../companies/acme-ai.md')).toBe('companies/acme-ai');
  });

  test('returns slug unchanged if no .md or ../', () => {
    expect(resolveSlug('people/alice')).toBe('people/alice');
  });

  test('handles just a filename', () => {
    expect(resolveSlug('page.md')).toBe('page');
  });

  test('handles nested paths', () => {
    expect(resolveSlug('../yc/s24/companies/startup.md')).toBe('yc/s24/companies/startup');
  });

  test('normalizes backslashes to forward slashes', () => {
    expect(resolveSlug('people\\alice.md')).toBe('people/alice');
  });

  test('handles empty string', () => {
    expect(resolveSlug('')).toBe('');
  });
});
