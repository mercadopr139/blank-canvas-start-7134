import { hasHtmlTags, sanitizeHtml } from "@/lib/richText";
import { cn } from "@/lib/utils";

// Renders admin-authored rich text safely. Legacy plain-text content (no HTML
// tags) is shown verbatim with line breaks preserved; rich content is
// sanitized and rendered as HTML. The `rich-text` class styles lists/spacing
// (see index.css). Color/size are inherited, so pass those via className.
export const RichText = ({ html, className }: { html?: string | null; className?: string }) => {
  if (!html) return null;
  if (!hasHtmlTags(html)) {
    return <div className={cn("whitespace-pre-wrap", className)}>{html}</div>;
  }
  return (
    <div
      className={cn("rich-text", className)}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
};

export default RichText;
