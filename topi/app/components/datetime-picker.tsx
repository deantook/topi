"use client";

import { Sun, ArrowRight, CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

const HH_MM_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function isValidTime(value: string): boolean {
  return HH_MM_REGEX.test(value) || value === "";
}

export function formatDueDateForDisplay(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return "";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  const timePart = dateStr.length >= 19 ? dateStr.slice(11, 16) : null;
  return timePart
    ? `${parseInt(m, 10)}月${parseInt(d, 10)}日 ${timePart}`
    : `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

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
}

export function DateTimePicker({
  value,
  onChange,
  onConfirm,
}: DateTimePickerProps) {
  const datePart = value ? value.slice(0, 10) : null;
  const timePart =
    value && value.length >= 16 ? value.slice(11, 16) : "00:00";

  const fallbackDate = () => {
    const d = new Date();
    return toDateString(d);
  };

  return (
    <div className="flex flex-col gap-2 p-2">
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

      <Calendar
        mode="single"
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

      <div className="flex items-center gap-2 border-t pt-2">
        <input
          type="time"
          aria-label="时间"
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
          className="h-8 w-20 min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onChange(null)}
        >
          清除
        </Button>
        <Button
          type="button"
          variant="default"
          size="xs"
          onClick={() => onConfirm?.()}
        >
          确定
        </Button>
      </div>
    </div>
  );
}
