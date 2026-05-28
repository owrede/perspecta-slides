/**
 * Slide-chunk serializer — pure functions that own the split/join/canonicalise
 * pipeline for slide bodies in Perspecta's `.md` deck format.
 *
 * Extracted from main.ts to keep the plugin's God-object in check. These were
 * all `private` methods on the plugin class but had no dependency on plugin
 * state — they're pure transforms on string content. Moving them here makes
 * the format invariants discoverable and unit-testable without spinning up
 * Obsidian.
 *
 * Format recap:
 *
 *   ---            ← YAML frontmatter (separate concern, untouched here)
 *   key: value
 *   ---
 *
 *   slide 1 content
 *
 *   ---            ← slide separator (≥3 dashes, only whitespace after)
 *
 *   layout: cover  ← per-slide meta block (tight against separator, no blank line)
 *   mode: dark
 *
 *   slide 2 content
 *
 *   -----          ← named-act separator was once `----- Foo`; chapter labels
 *                  ←   now live in the meta block as `chapter:` instead
 *
 *   slide 3 content
 *
 * MUST stay in sync with SlideParser.splitIntoSlideRawContents.
 */

/** A slide separator is `---+` (≥3 dashes) followed by optional whitespace only. */
export function isSlideSeparator(line: string): boolean {
  return /^-{3,}\s*$/.test(line);
}

/**
 * Splits a presentation body (markdown after the frontmatter block) into
 * slide-content chunks and the literal separator lines between them, with
 * the same semantics as `SlideParser.splitIntoSlideRawContents`:
 *
 *   - `---+` (≥3 dashes, only whitespace after) → plain slide separator
 *   - `-----+ <label>` (≥5 dashes, then text) → named act separator
 *   - Lines inside ``` / ~~~ fenced code blocks are content, not separators
 *
 * Result invariant: `separators.length === slideRawContents.length - 1`
 * (one separator between each adjacent pair of slide chunks). Each
 * `separators[i]` is the bare separator line as it appeared in the
 * source (no surrounding newlines), so callers that re-assemble the body
 * must add newlines around it.
 *
 * Use this helper in any place that previously did
 * `bodyContent.split(/(\n---+\s*\n)/)` — that regex misses code fences,
 * named act breaks, and any separator without surrounding blank lines.
 */
export function splitBodyAtSeparators(bodyContent: string): {
  slideRawContents: string[];
  separators: string[];
} {
  const slideRawContents: string[] = [];
  const separators: string[] = [];
  const bodyLines = bodyContent.split('\n');
  let currentSlideLines: string[] = [];
  let fenceChar: '`' | '~' | null = null;

  const flush = () => {
    slideRawContents.push(currentSlideLines.join('\n'));
    currentSlideLines = [];
  };

  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (fenceChar === null) {
      if (trimmed.startsWith('```')) {
        fenceChar = '`';
        currentSlideLines.push(line);
        continue;
      }
      if (trimmed.startsWith('~~~')) {
        fenceChar = '~';
        currentSlideLines.push(line);
        continue;
      }
    } else {
      if (trimmed.startsWith(fenceChar.repeat(3))) {
        fenceChar = null;
      }
      currentSlideLines.push(line);
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      flush();
      separators.push(line);
      continue;
    }
    currentSlideLines.push(line);
  }
  flush();
  return { slideRawContents, separators };
}

/**
 * Inverse of `splitBodyAtSeparators`: join slide-content chunks back into
 * a single body string with separator lines between them.
 *
 * Spacing rules around each separator:
 *
 *  - **Before the separator**: always a blank line. Markdown reads
 *    `text\n---` as a Setext H2 (the `---` underlines the preceding text)
 *    instead of an HR, which is why Obsidian's Live Preview otherwise
 *    drops the divider. Mandatory.
 *
 *  - **After the separator**: depends on what the next chunk starts with:
 *      * If the next chunk's first non-blank line is a meta-block line
 *        (matches `key:`), no blank line — the meta block binds tightly
 *        to the separator.
 *      * Otherwise (heading, paragraph, list, …) one blank line, so the
 *        content has visual breathing room and Markdown doesn't fold the
 *        line into the separator.
 *
 * Callers don't have to pre-clean their chunks: leading/trailing blank
 * lines on chunks are trimmed here.
 */
export function joinSlideChunksWithSeparators(
  chunks: string[],
  separators: string[]
): string {
  if (chunks.length === 0) {
    return '';
  }
  const trim = (s: string) => s.replace(/^\n+/, '').replace(/\n+$/, '');
  // A meta-block line is a `key: ...` line whose key matches an ASCII
  // identifier — same pattern parseSlideChunk uses for detection.
  const startsWithMeta = (chunk: string) => /^[a-zA-Z][\w-]*\s*:\s*/.test(chunk);

  let body = trim(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    const separatorLine = separators[i - 1] || '---';
    const nextChunk = trim(chunks[i]);
    const afterSeparator = startsWithMeta(nextChunk) ? '\n' : '\n\n';
    body += '\n\n' + separatorLine + afterSeparator + nextChunk;
  }
  return body;
}

/**
 * Semantic order used when serialising the meta block back to text.
 * Keys not in this list are emitted alphabetically after these.
 */
export const META_ORDER = [
  'layout',
  'mode',
  'background',
  'opacity',
  'filter',
  'hide-overlay',
  'chapter',
] as const;

/**
 * Aliases the user (or older versions of this plugin) might have written.
 * Applied when reading; the output always uses the canonical form on the
 * right-hand side.
 */
export const META_KEY_ALIASES: Record<string, string> = {
  hideoverlay: 'hide-overlay',
};

/**
 * Parse a slide-content chunk into a meta dictionary and a content body.
 *
 * Tolerates the kinds of "almost-canonical" formatting humans (and prior
 * naïve writes) leave behind: leading blank lines, blank lines within the
 * meta block, trailing whitespace, capitalised keys, mixed key
 * separators. Anything before the first line that is non-blank and not a
 * `key: value` pattern is the meta block.
 *
 * Returns the meta as a Record keyed by canonical lower-case (with
 * `hide-overlay` not `hideOverlay`), and the content as a raw string (no
 * leading/trailing blanks). Companion to `serializeSlideChunk`.
 */
export function parseSlideChunk(chunk: string): {
  meta: Record<string, string>;
  content: string;
} {
  const lines = chunk.split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[0] === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const meta: Record<string, string> = {};
  let contentStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      continue;
    } // blank inside meta region — tolerated
    const m = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
    if (!m) {
      contentStart = i;
      break;
    }
    const rawKey = m[1].toLowerCase();
    const key = META_KEY_ALIASES[rawKey] ?? rawKey;
    meta[key] = m[2];
    contentStart = i + 1;
  }

  const contentLines = lines.slice(contentStart);
  while (contentLines.length > 0 && contentLines[0] === '') {
    contentLines.shift();
  }
  while (contentLines.length > 0 && contentLines[contentLines.length - 1] === '') {
    contentLines.pop();
  }
  const collapsed: string[] = [];
  let prevBlank = false;
  for (const line of contentLines) {
    const isBlank = line === '';
    if (isBlank && prevBlank) {
      continue;
    }
    collapsed.push(line);
    prevBlank = isBlank;
  }
  return { meta, content: collapsed.join('\n') };
}

/**
 * Serialise a meta dictionary + content body into canonical slide-chunk
 * form (meta keys in semantic order, single blank line between meta and
 * content). Companion to `parseSlideChunk`.
 */
export function serializeSlideChunk(meta: Record<string, string>, content: string): string {
  const orderedKeys: string[] = [];
  for (const k of META_ORDER) {
    if (k in meta) {
      orderedKeys.push(k);
    }
  }
  const extras = Object.keys(meta).filter((k) => !(META_ORDER as readonly string[]).includes(k));
  extras.sort();
  orderedKeys.push(...extras);

  const metaLines = orderedKeys
    .filter((k) => meta[k] !== undefined && meta[k] !== '')
    .map((k) => `${k}: ${meta[k]}`.replace(/\s+$/, ''));

  if (metaLines.length === 0 && content === '') {
    return '';
  }
  if (metaLines.length === 0) {
    return content;
  }
  if (content === '') {
    return metaLines.join('\n');
  }
  return metaLines.join('\n') + '\n\n' + content;
}

/**
 * Bring a slide-content chunk into canonical shape so that subsequent
 * meta-block operations have an unambiguous starting point: meta keys
 * collected and sorted in semantic order, single blank line separating
 * meta from content, runs of blank lines in content collapsed to one,
 * trailing whitespace stripped, leading/trailing blank lines removed.
 *
 * Used both as a preprocessing step in every meta-mutating operation
 * (`updateSlideMetadata`, `updateSlideHiddenState`) and standalone by the
 * "Tidy all slides" command.
 */
export function tidySlideChunk(chunk: string): string {
  const { meta, content } = parseSlideChunk(chunk);
  return serializeSlideChunk(meta, content);
}

/**
 * Parse a slide's `startlevel` meta into a heading level (1–3). Accepts
 * either a hash form (`#`, `##`, `###`) or a numeric form (`1`, `2`, `3`).
 * Returns 1 (the default — slides start at level 1) for missing/invalid
 * values.
 */
export function parseStartLevel(value: string | undefined): number {
  if (!value) {return 1;}
  const v = value.trim();
  const hashes = v.match(/^#{1,3}$/);
  if (hashes) {return hashes[0].length;}
  const n = parseInt(v, 10);
  if (n >= 1 && n <= 3) {return n;}
  return 1;
}

/**
 * Normalise the heading levels inside one slide chunk so the slide's
 * top-most heading sits at the target level (from the slide's `startlevel`
 * meta, default 1), shifting every other heading by the same delta to keep
 * the relative hierarchy intact. Headings inside fenced code blocks are left
 * untouched, and resulting levels are clamped to the valid `#`..`######`
 * range.
 *
 * Example: a slide whose headings are `## Title` / `### Sub`, with no
 * `startlevel`, becomes `# Title` / `## Sub` (delta -1). With
 * `startlevel: ##` it stays `## Title` / `### Sub`.
 */
export function lintSlideChunkHeadings(chunk: string): string {
  const { meta, content } = parseSlideChunk(chunk);
  if (content === '') {return serializeSlideChunk(meta, content);}

  const targetTop = parseStartLevel(meta['startlevel']);
  const lines = content.split('\n');

  // First pass: find the minimum heading level present (outside code fences).
  const headingRe = /^(#{1,6})(\s+\S.*)$/;
  let fenceChar: string | null = null;
  let minLevel = Infinity;
  for (const line of lines) {
    const fence = line.match(/^(```+|~~~+)/);
    if (fence) {
      const ch = fence[1][0];
      if (fenceChar === null) {fenceChar = ch;}
      else if (fenceChar === ch) {fenceChar = null;}
      continue;
    }
    if (fenceChar !== null) {continue;}
    const m = line.match(headingRe);
    if (m) {minLevel = Math.min(minLevel, m[1].length);}
  }

  // No headings: nothing to normalise.
  if (!Number.isFinite(minLevel)) {return serializeSlideChunk(meta, content);}

  const delta = targetTop - minLevel;
  if (delta === 0) {return serializeSlideChunk(meta, content);}

  // Second pass: shift each heading by delta, clamped to [1, 6].
  fenceChar = null;
  const shifted = lines.map((line) => {
    const fence = line.match(/^(```+|~~~+)/);
    if (fence) {
      const ch = fence[1][0];
      if (fenceChar === null) {fenceChar = ch;}
      else if (fenceChar === ch) {fenceChar = null;}
      return line;
    }
    if (fenceChar !== null) {return line;}
    const m = line.match(headingRe);
    if (!m) {return line;}
    const newLevel = Math.min(6, Math.max(1, m[1].length + delta));
    return '#'.repeat(newLevel) + m[2];
  });

  return serializeSlideChunk(meta, shifted.join('\n'));
}

/** Return the line index immediately after the closing `---` of the YAML frontmatter, or 0 if none. */
export function findFrontmatterEnd(lines: string[]): number {
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 && lines[i].trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && lines[i].trim() === '---') {
      return i + 1;
    }
  }
  return 0;
}

/**
 * Given the full document content and a line number, return the 0-based
 * slide index that contains that line. Slide 0 is everything between the
 * frontmatter and the first separator; later slides are between separator
 * `n-1` and separator `n`. Code-fence aware so a `---` inside a fenced
 * block is not counted as a separator.
 */
export function getSlideIndexAtLine(content: string, lineNumber: number): number {
  const lines = content.split('\n');
  const frontmatterEnd = findFrontmatterEnd(lines);

  // If cursor is in frontmatter, return slide 0
  if (lineNumber < frontmatterEnd) {
    return 0;
  }

  // Count slide separators before the cursor line, ignoring those inside code blocks
  let slideIndex = 0;
  let inCodeBlock = false;

  for (let i = frontmatterEnd; i <= lineNumber && i < lines.length; i++) {
    const line = lines[i];

    // Track code block state (``` at start of line)
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Only count separators outside code blocks
    if (!inCodeBlock && isSlideSeparator(line)) {
      slideIndex++;
    }
  }

  return slideIndex;
}

/** Heuristic match for a per-slide metadata line — recognises the well-known keys. */
export function isSlideMetadataLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') {
    return false;
  }
  // Match patterns like "layout: title", "mode: dark", "background: image.jpg", "opacity: 50%", "class: custom"
  return /^(layout|mode|background|opacity|class):\s*.+$/i.test(trimmed);
}

/**
 * Inverse of `getSlideIndexAtLine`: return the line number where slide
 * content begins for the given slide index. Skips the meta block so the
 * returned line is the first line of actual visible content (heading,
 * paragraph, …). Code-fence aware.
 */
export function getLineNumberForSlide(content: string, slideIndex: number): number {
  const lines = content.split('\n');
  const frontmatterEnd = findFrontmatterEnd(lines);

  // Helper to skip metadata block and blank lines, return first content line
  const skipToContent = (startLine: number): number => {
    let i = startLine;
    // Skip blank lines first
    while (i < lines.length && lines[i].trim() === '') {
      i++;
    }
    // Skip metadata lines (layout:, mode:, etc.)
    while (i < lines.length && isSlideMetadataLine(lines[i])) {
      i++;
    }
    // Skip any blank lines after metadata
    while (i < lines.length && lines[i].trim() === '') {
      i++;
    }
    return i < lines.length ? i : startLine;
  };

  // Slide 0 starts right after frontmatter
  if (slideIndex === 0) {
    return skipToContent(frontmatterEnd);
  }

  // Find the nth slide separator, ignoring those inside code blocks
  let separatorCount = 0;
  let inCodeBlock = false;

  for (let i = frontmatterEnd; i < lines.length; i++) {
    const line = lines[i];

    // Track code block state (``` at start of line)
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Only count separators outside code blocks
    if (!inCodeBlock && isSlideSeparator(line)) {
      separatorCount++;
      if (separatorCount === slideIndex) {
        return skipToContent(i + 1);
      }
    }
  }

  return frontmatterEnd;
}
