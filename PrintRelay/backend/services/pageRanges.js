import { ApiError } from '../utils/ApiError.js';

const bad = (msg) => ApiError.unprocessable(msg, undefined, 'INVALID_PAGE_RANGE');

/**
 * Parses "1-5, 8, 10-12" against a document with `pageCount` pages.
 * Rejects empty entries, zero/negative numbers, reversed ranges, out-of-range pages and any duplicates/overlaps.
 */
export function parsePageRanges(input, pageCount) {
  if (typeof input !== 'string' || !input.trim()) throw bad('Enter the pages to print, for example 1-5, 8, 10-12');
  if (input.length > 200) throw bad('The page list is too long');

  const ranges = [];
  for (const raw of input.split(',')) {
    const token = raw.trim();
    if (!token) throw bad('Remove the empty entry in your page list');
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!m) throw bad(`"${token}" is not a valid page or range. Use numbers like 3 or 5-9`);
    const start = Number(m[1]);
    const end = m[2] !== undefined ? Number(m[2]) : start;
    if (start < 1 || end < 1) throw bad('Page numbers start at 1');
    if (end < start) throw bad(`"${token}" is backwards. Write it as ${end}-${start}`);
    if (end > pageCount) throw bad(`Page ${end} is outside the document, which has ${pageCount} page${pageCount === 1 ? '' : 's'}`);
    ranges.push([start, end]);
  }

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i][0] <= sorted[i - 1][1]) throw bad(`Page ${sorted[i][0]} is listed more than once`);
  }

  const count = ranges.reduce((sum, [s, e]) => sum + (e - s + 1), 0);
  const normalized = ranges.map(([s, e]) => (s === e ? `${s}` : `${s}-${e}`)).join(', ');
  return { ranges, count, normalized };
}

export function resolveSelection(selection, pageCount) {
  if (selection.mode === 'ALL') return { mode: 'ALL', ranges: undefined, selectedPages: pageCount };
  const { count, normalized } = parsePageRanges(selection.ranges, pageCount);
  return { mode: 'RANGE', ranges: normalized, selectedPages: count };
}
