import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  ChevronDown,
  ChevronRight,
  Italic,
  List,
  ListOrdered,
  Undo2,
} from 'lucide-react';

type Props = {
  sectionCle: string;
  libelle: string;
  valueHtml: string;
  editable: boolean;
  defaultOpen?: boolean;
  onChange: (cle: string, html: string) => void;
};

export function CrSectionEditor({
  sectionCle,
  libelle,
  valueHtml,
  editable,
  defaultOpen = true,
  onChange,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: valueHtml || '<p></p>',
    editable,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[7rem] px-3 py-2 focus:outline-none text-text',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(sectionCle, ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (valueHtml && valueHtml !== current) {
      editor.commands.setContent(valueHtml, { emitUpdate: false });
    }
  }, [editor, valueHtml]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 bg-surface-muted/60 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-ogefrem-blue" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-ogefrem-blue" aria-hidden />
        )}
        <span className="text-sm font-semibold text-text">{libelle}</span>
      </button>

      {open && (
        <div className="border-t border-border">
          {editable && editor && (
            <div
              className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5"
              role="toolbar"
              aria-label={`Mise en forme — ${libelle}`}
            >
              <ToolbarBtn
                label="Gras"
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <Bold className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn
                label="Italique"
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <Italic className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn
                label="Liste"
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <List className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn
                label="Liste numérotée"
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn
                label="Annuler"
                onClick={() => editor.chain().focus().undo().run()}
              >
                <Undo2 className="h-4 w-4" />
              </ToolbarBtn>
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      )}
    </section>
  );
}

function ToolbarBtn({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-9 w-9', active && 'bg-ogefrem-blue/10 text-ogefrem-blue')}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
