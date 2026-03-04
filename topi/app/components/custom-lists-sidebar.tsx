import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { List, Plus, Pencil, Trash2 } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { useCustomLists } from "@/hooks/use-custom-lists";

function CustomListItem({
  id,
  name,
  isActive,
  onRename,
  onDelete,
}: {
  id: string;
  name: string;
  isActive: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <SidebarMenuItem>
        <div className="flex h-8 items-center gap-1 px-2">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") {
                setValue(name);
                setEditing(false);
              }
            }}
            onBlur={handleSubmit}
            className="h-7 text-sm"
          />
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={name}
      >
        <Link to={`/list/${id}`} className="group/item">
          <List className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
        </Link>
      </SidebarMenuButton>
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 group-hover/menu-item:opacity-100 transition-opacity [@media(hover:none)]:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setEditing(true);
          }}
          className="flex size-6 items-center justify-center rounded-md p-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="重命名"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (window.confirm(`确定删除「${name}」？`)) onDelete();
          }}
          className="flex size-6 items-center justify-center rounded-md p-0 text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive"
          aria-label="删除"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </SidebarMenuItem>
  );
}

export function CustomListsSidebar() {
  const { lists, addList, updateList, deleteList } = useCustomLists();
  const location = useLocation();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (trimmed) {
      addList(trimmed);
      setNewName("");
      setIsAdding(false);
    } else {
      addList("新清单");
      setIsAdding(false);
    }
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center justify-between">
        <span>我的清单</span>
        <SidebarGroupAction asChild>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex size-5 items-center justify-center rounded hover:bg-sidebar-accent"
            aria-label="添加清单"
          >
            <Plus className="size-4" />
          </button>
        </SidebarGroupAction>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {lists.map((list) => (
            <CustomListItem
              key={list.id}
              id={list.id}
              name={list.name}
              isActive={location.pathname === `/list/${list.id}`}
              onRename={(name) => updateList(list.id, name)}
              onDelete={() => deleteList(list.id)}
            />
          ))}
          {isAdding && (
            <SidebarMenuItem>
              <div className="flex h-8 items-center gap-1 px-2">
                <Input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (newName.trim()) handleAdd();
                      else setIsAdding(false);
                    }
                    if (e.key === "Escape") {
                      setNewName("");
                      setIsAdding(false);
                    }
                  }}
                  onBlur={() => {
                    if (newName.trim()) handleAdd();
                    else setIsAdding(false);
                  }}
                  placeholder="清单名称"
                  className="h-7 text-sm"
                />
              </div>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
