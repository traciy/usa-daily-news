import { useEffect, useState } from 'react';

/**
 * Lightweight markdown-to-HTML renderer for article content.
 * Supports headings (#, ##, ###), bold (**), italic (*), links, blockquotes,
 * unordered/ordered lists, and paragraphs. Escapes HTML for safety.
 *
 * Paragraph handling: content is split on blank lines into blocks. Each text
 * block becomes one <p>. If the whole article yields only a single paragraph,
 * it is split at sentence boundaries so readers always get at least two
 * readable paragraphs.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  // links [text](url)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-700 underline hover:text-blue-900">$1</a>'
  );
  // bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic *text*
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

/** Split a single text block into multiple paragraphs at sentence boundaries. */
function splitSentencesIntoParagraphs(text: string): string[] {
  // Split after sentence-ending punctuation followed by whitespace + capital.
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  if (sentences.length < 2) return [text];

  // Group sentences into ~2-3 balanced paragraphs.
  const total = sentences.length;
  const target = Math.min(3, Math.max(2, Math.ceil(total / 3)));
  const perGroup = Math.ceil(total / target);
  const paragraphs: string[] = [];
  for (let i = 0; i < total; i += perGroup) {
    paragraphs.push(sentences.slice(i, i + perGroup).join('').trim());
  }
  return paragraphs.filter((p) => p.length > 0);
}

function renderBlock(block: string): string[] {
  const lines = block.split('\n');
  const html: string[] = [];
  let i = 0;
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { html.push('</ul>'); inUl = false; }
    if (inOl) { html.push('</ol>'); inOl = false; }
  };

  // Collect non-special lines into a paragraph buffer.
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    const text = paraBuf.join(' ').trim();
    paraBuf = [];
    if (text) {
      html.push(`<p class="mb-5 text-gray-800 leading-[1.85] font-serif text-[1.125rem]">${renderInline(text)}</p>`);
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      closeLists();
      flushPara();
      i++;
      continue;
    }

    // headings
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      closeLists();
      flushPara();
      const level = h[1].length;
      const sizes = ['text-2xl', 'text-xl', 'text-lg'];
      html.push(
        `<h${level} class="${sizes[level - 1]} font-serif font-bold mt-8 mb-4 text-gray-900 leading-tight">${renderInline(h[2])}</h${level}>`
      );
      i++;
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      closeLists();
      flushPara();
      html.push(`<blockquote class="border-l-4 border-gray-300 pl-5 italic text-gray-700 my-5 font-serif text-[1.125rem]">${renderInline(line.replace(/^>\s?/, ''))}</blockquote>`);
      i++;
      continue;
    }

    // unordered list
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!inUl) { html.push('<ul class="list-disc pl-6 my-4 space-y-1.5 text-gray-800 font-serif text-[1.125rem]">'); inUl = true; }
      html.push(`<li>${renderInline(line.replace(/^[-*]\s+/, ''))}</li>`);
      i++;
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      flushPara();
      if (!inOl) { html.push('<ol class="list-decimal pl-6 my-4 space-y-1.5 text-gray-800 font-serif text-[1.125rem]">'); inOl = true; }
      html.push(`<li>${renderInline(line.replace(/^\d+\.\s+/, ''))}</li>`);
      i++;
      continue;
    }

    // normal paragraph line — buffer it
    closeLists();
    paraBuf.push(line.trim());
    i++;
  }
  closeLists();
  flushPara();

  return html;
}

function renderMarkdown(md: string): string {
  // Split into blocks on blank lines (2+ newlines).
  const blocks = md.replace(/\r\n/g, '\n').split(/\n{2,}/);

  let htmlParts: string[] = [];
  let paragraphCount = 0;
  let firstParaText = '';

  for (const block of blocks) {
    if (block.trim() === '') continue;
    const parts = renderBlock(block);
    // Count <p> tags produced by this block for the split-single-para rule.
    for (const p of parts) {
      if (p.startsWith('<p')) {
        paragraphCount += 1;
        if (paragraphCount === 1) {
          firstParaText = p;
        }
      }
    }
    htmlParts.push(...parts);
  }

  // If the whole article produced only one paragraph, split it into 2+.
  if (paragraphCount === 1 && firstParaText) {
    // Recover the inner text from the single <p> we captured.
    const innerMatch = /<p[^>]*>([\s\S]*)<\/p>/.exec(firstParaText);
    if (innerMatch) {
      // Un-escape to plain text, then re-split on sentence boundaries.
      const plain = innerMatch[1]
        .replace(/<strong>([^<]*)<\/strong>/g, '**$1**')
        .replace(/<em>([^<]*)<\/em>/g, '*$1*')
        .replace(/<a [^>]*>([^<]*)<\/a>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      const chunks = splitSentencesIntoParagraphs(plain);
      if (chunks.length > 1) {
        const paraHtml = chunks.map(
          (c) =>
            `<p class="mb-5 text-gray-800 leading-[1.85] font-serif text-[1.125rem]">${renderInline(c)}</p>`
        );
        // Replace the single paragraph in htmlParts with the split version.
        htmlParts = htmlParts.flatMap((p) => (p === firstParaText ? paraHtml : [p]));
      }
    }
  }

  return htmlParts.join('\n');
}

export function useMarkdown(md: string | null | undefined): string {
  const [html, setHtml] = useState('');
  useEffect(() => {
    if (!md) { setHtml(''); return; }
    setHtml(renderMarkdown(md));
  }, [md]);
  return html;
}
