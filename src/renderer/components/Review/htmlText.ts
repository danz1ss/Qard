export interface TextSegment {
  text: string;
  bold: boolean;
}

const TAG_RE = /<[^>]+>/g;
const BOLD_SPAN_RE = /<b>([\s\S]*?)<\/b>/gi;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Inline-очистка БЕЗ схлопывания/тримминга — чтобы пробелы между сегментами жили. */
function cleanInline(s: string): string {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, ' ').replace(TAG_RE, ''));
}

/** Полная очистка до простого текста: теги прочь, <br>→пробел, схлопнуть пробелы, trim. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(TAG_RE, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Есть ли в строке непустой <b>…</b>. */
export function hasBold(html: string): boolean {
  return /<b>[\s\S]*?<\/b>/i.test(html);
}

/** Разбить строку с <b>…</b> на сегменты {text, bold}, сохраняя соседние пробелы. */
export function parseBold(html: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(BOLD_SPAN_RE);
  while ((m = re.exec(html)) !== null) {
    if (m.index > lastIndex) {
      const before = cleanInline(html.slice(lastIndex, m.index));
      if (before) segments.push({ text: before, bold: false });
    }
    const inner = cleanInline(m[1]);
    if (inner) segments.push({ text: inner, bold: true });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < html.length) {
    const rest = cleanInline(html.slice(lastIndex));
    if (rest) segments.push({ text: rest, bold: false });
  }
  return segments;
}

/** Заменить <b>…</b> на placeholder, остальные теги убрать. */
export function blankOut(html: string, placeholder = '______'): string {
  return stripTags(html.replace(BOLD_SPAN_RE, placeholder));
}

/** Сравнение ответа со словом: без регистра и крайних пробелов, точное совпадение. */
export function isCorrect(input: string, word: string): boolean {
  return input.trim().toLowerCase() === word.trim().toLowerCase();
}
