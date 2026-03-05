"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

export interface TaskDetailEditorProps {
  value: string;
  onSave: (markdown: string) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 500;

export function TaskDetailEditor({ value, onSave, placeholder = "添加任务详情..." }: TaskDetailEditorProps) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "min-h-[200px] w-full px-3 py-2 text-sm text-foreground outline-none focus:outline-none",
      },
      placeholder,
    },
    immediatelyRender: false,
  });

  // Sync content when value prop changes (e.g. switching tasks)
  useEffect(() => {
    if (!editor) return;
    const current = (editor.storage.markdown as { getMarkdown?: () => string } | undefined)?.getMarkdown?.() ?? "";
    const normalized = (value || "").trim();
    if (normalized !== current.trim()) {
      editor.commands.setContent(normalized || "");
    }
  }, [editor, value]);

  // Debounced save on update
  useEffect(() => {
    if (!editor) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const markdown = (editor.storage.markdown as { getMarkdown?: () => string } | undefined)?.getMarkdown?.() ?? "";
        onSaveRef.current(markdown);
      }, DEBOUNCE_MS);
    };
    editor.on("update", handleUpdate);
    editor.on("blur", () => {
      clearTimeout(timeoutId);
      const markdown = (editor.storage.markdown as { getMarkdown?: () => string } | undefined)?.getMarkdown?.() ?? "";
      onSaveRef.current(markdown);
    });
    return () => {
      editor.off("update", handleUpdate);
      clearTimeout(timeoutId);
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className="min-h-[200px] w-full rounded-md border border-input bg-muted/20 animate-pulse" />
    );
  }

  return (
    <div className="rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
      <EditorContent editor={editor} />
    </div>
  );
}
