import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { toEditorHtml, isEmptyHtml } from "@/lib/richText";

// Shared rich-text editor for admin-authored copy. Basic formatting only —
// bold / italic / underline / bullet + numbered lists — matching the tight
// allow-list in lib/richText. Emits a small HTML subset via onChange.

const ToolbarButton = ({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()} // keep the text selection while clicking
    onClick={onClick}
    className={cn(
      "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
      active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
    )}
  >
    {children}
  </button>
);

const Toolbar = ({ editor }: { editor: Editor }) => (
  <div className="flex items-center gap-0.5 border-b border-input px-1.5 py-1 bg-muted/40 rounded-t-md">
    <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
      <Bold className="w-4 h-4" />
    </ToolbarButton>
    <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
      <Italic className="w-4 h-4" />
    </ToolbarButton>
    <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
      <UnderlineIcon className="w-4 h-4" />
    </ToolbarButton>
    <div className="w-px h-5 bg-border mx-1" />
    <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
      <List className="w-4 h-4" />
    </ToolbarButton>
    <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
      <ListOrdered className="w-4 h-4" />
    </ToolbarButton>
  </div>
);

export const RichTextEditor = ({
  value, onChange, placeholder, minHeight = 140, className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
      }),
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        class: "rich-text px-3 py-2.5 text-sm text-foreground focus:outline-none overflow-y-auto",
        style: `min-height:${minHeight}px;max-height:340px`,
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(isEmptyHtml(html) ? "" : html);
    },
  });

  // Sync when the field is swapped externally (e.g. opening a different waiver
  // in the same dialog) without clobbering the cursor during normal typing.
  useEffect(() => {
    if (!editor) return;
    const incoming = toEditorHtml(value);
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
