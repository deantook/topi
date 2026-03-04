"use client";

import type { ReactNode } from "react";
import { Sun, ArrowRight, CalendarDays, CalendarClock, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Field } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { isValidTime } from "@/lib/date-utils";

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTodayAt0900(): string {
  const d = new Date();
  return `${toDateString(d)} 09:00:00`;
}

function getTomorrowAt0900(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${toDateString(d)} 09:00:00`;
}

function getNextMondayAt0900(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToAdd = day === 1 ? 7 : (8 - day) % 7;
  d.setDate(d.getDate() + daysToAdd);
  return `${toDateString(d)} 09:00:00`;
}

export interface DateTimePickerProps {
  value: string | null;
  onChange: (v: string | null) => void;
  onConfirm?: () => void;
  onClear?: () => void;
}

export function DateTimePicker({
  value,
  onChange,
  onConfirm,
  onClear,
}: DateTimePickerProps) {
  const datePart = value ? value.slice(0, 10) : null;
  const timePart =
    value && value.length >= 16 ? value.slice(11, 16) : "00:00";

  const fallbackDate = () => {
    const d = new Date();
    return toDateString(d);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md p-2 bg-white dark:bg-neutral-900">
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => onChange(getTodayAt0900())}
          aria-label="今天"
        >
          <Sun className="size-3.5" />
          今天
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => onChange(getTomorrowAt0900())}
          aria-label="明天"
        >
          <ArrowRight className="size-3.5" />
          明天
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => onChange(getNextMondayAt0900())}
          aria-label="下周"
        >
          <CalendarDays className="size-3.5" />
          下周
        </Button>
      </div>

      <div role="group" aria-label="选择日期" className="bg-white dark:bg-neutral-900">
        <Calendar
          mode="single"
          className="!bg-white dark:!bg-neutral-900"
          selected={datePart ? new Date(datePart + "T12:00:00") : undefined}
          onSelect={(date: Date | undefined) => {
          if (!date) return;
          const ds = toDateString(date);
          const time =
            value && value.length >= 16 && isValidTime(value.slice(11, 16))
              ? value.slice(11, 16)
              : "00:00";
          onChange(`${ds} ${time}:00`);
        }}
        />
      </div>

      <div className="flex items-end gap-2 border-t pt-2">
        <Field className="min-w-0 flex-1">
          <InputGroup>
            <InputGroupInput
              id="datetime-time"
              type="time"
              step="60"
              value={timePart}
              onChange={(e) => {
                const v = e.target.value;
                const useDate = datePart ?? fallbackDate();
                onChange(`${useDate} ${v}:00`);
              }}
              onFocus={() => {
                if (!value) {
                  onChange(`${fallbackDate()} 00:00:00`);
                }
              }}
              className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
            <InputGroupAddon>
              <Clock className="size-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
          onClick={() => {
            onChange(null);
            onClear?.();
          }}
        >
          清除
        </Button>
      </div>
    </div>
  );
}

export interface DateTimePickerPopoverProps {
  value: string | null;
  onChange: (v: string | null) => void;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentProps?: React.ComponentProps<typeof PopoverContent>;
}

export function DateTimePickerPopover({
  value,
  onChange,
  trigger,
  open,
  onOpenChange,
  contentProps,
}: DateTimePickerPopoverProps) {
  const defaultTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="截止日期"
      className="shrink-0 text-muted-foreground"
    >
      <CalendarClock className="size-4" />
    </Button>
  );

  const { className: contentClassName, ...restContentProps } = contentProps ?? {};

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? defaultTrigger}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        avoidCollisions={false}
        className={cn(
          "w-auto overflow-hidden rounded-md border p-0 !bg-white dark:!bg-neutral-900",
          contentClassName
        )}
        {...restContentProps}
      >
        <DateTimePicker
          value={value}
          onChange={onChange}
          onConfirm={() => onOpenChange?.(false)}
          onClear={() => onOpenChange?.(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
