import DOMPurify from "dompurify";

// Rich text used for admin-authored copy (waiver bodies, signature agreement
// text, instruction paragraphs). Stored as a small subset of HTML. Everything
// that renders to a parent goes through sanitizeHtml first.

// The only formatting we allow. Keep this list tight — anything outside it is
// stripped on save/render, so a stray paste can never inject unsafe markup.
const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li"];
const ALLOWED_ATTR: string[] = [];

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Does this string already contain HTML markup (i.e. was authored with the
// rich editor)? Legacy waivers are plain text and must keep rendering verbatim.
export const hasHtmlTags = (s?: string | null): boolean =>
  !!s && /<\/?[a-z][\s\S]*?>/i.test(s);

// Turn a legacy plain-text block into equivalent HTML: blank lines become
// paragraph breaks, single newlines become <br>. Escapes first so literal
// < & > in old waivers stay literal.
export const plainTextToHtml = (s: string): string =>
  s
    .split(/\n{2,}/)
    .map((block) => `<p>${block.split(/\n/).map(escapeHtml).join("<br>")}</p>`)
    .join("");

// Strip anything outside the allow-list. Safe to render with dangerouslySetInnerHTML.
export const sanitizeHtml = (s: string): string =>
  DOMPurify.sanitize(s, { ALLOWED_TAGS, ALLOWED_ATTR });

// Value to seed the rich editor with, whichever format we have on hand.
export const toEditorHtml = (s?: string | null): string =>
  !s ? "" : hasHtmlTags(s) ? sanitizeHtml(s) : plainTextToHtml(s);

// True when the editor holds no real content (empty or just an empty paragraph).
export const isEmptyHtml = (s?: string | null): boolean =>
  !s || s.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "") === "";

// Flatten rich text to plain text for contexts that can't render HTML (PDFs,
// CSV, plain-text email). Block tags become newlines; entities are decoded.
export const htmlToPlainText = (s?: string | null): string => {
  if (!s) return "";
  if (!hasHtmlTags(s)) return s;
  return s
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|li|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
};
