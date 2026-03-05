"use client";

export interface TaskDetailEditorProps {
  value: string;
  onSave: (markdown: string) => void;
  placeholder?: string;
}

export function TaskDetailEditor({ value, onSave, placeholder = "添加任务详情..." }: TaskDetailEditorProps) {
  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    onSave(e.target.value);
  };

  return (
    <textarea
      className="min-h-[200px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      defaultValue={value}
      onBlur={handleBlur}
      placeholder={placeholder}
    />
  );
}
