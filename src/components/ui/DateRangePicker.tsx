"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateRangePickerProps {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  onComplete?: () => void; // Called after both from and to are selected
}

const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Monday-based start padding
  let startPadding = firstDay.getDay() - 1;
  if (startPadding < 0) startPadding = 6;

  for (let i = startPadding - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Fill to complete 6 rows (42 cells) or at least complete the last row
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
  }

  return days;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export default function DateRangePicker({ from, to, onFromChange, onToChange, onComplete }: DateRangePickerProps) {
  // Parse the "from" date to initialize the calendar view
  const [fromParts] = useState(() => {
    const [y, m] = (from || todayStr()).split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  const [viewYear, setViewYear] = useState(fromParts.year);
  const [viewMonth, setViewMonth] = useState(fromParts.month);

  // Track which part of the range we're selecting: "from" or "to"
  const [selecting, setSelecting] = useState<"from" | "to">("from");

  const days = getMonthDays(viewYear, viewMonth);
  const today = todayStr();

  const navigatePrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const navigateNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (dateStr: string) => {
    if (selecting === "from") {
      onFromChange(dateStr);
      // If new from is after current to, reset to
      if (dateStr > to) {
        onToChange(dateStr);
      }
      setSelecting("to");
    } else {
      // If selected date is before from, swap
      if (dateStr < from) {
        onFromChange(dateStr);
        setSelecting("to");
      } else {
        onToChange(dateStr);
        setSelecting("from");
        // Range is complete — notify parent after a brief moment
        if (onComplete) {
          setTimeout(onComplete, 400);
        }
      }
    }
  };

  const isInRange = (dateStr: string) => {
    return dateStr >= from && dateStr <= to;
  };

  const isRangeStart = (dateStr: string) => dateStr === from;
  const isRangeEnd = (dateStr: string) => dateStr === to;

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden mb-3"
    >
      <div className="bg-dark-700 rounded-xl p-3 border border-dark-500">
        {/* From / To pills */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSelecting("from")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              selecting === "from"
                ? "bg-chicken-primary/20 text-chicken-primary border border-chicken-primary/40"
                : "bg-dark-600 text-gray-400 border border-transparent"
            }`}
          >
            <span className="text-[10px] uppercase block mb-0.5">From</span>
            {from ? new Date(from + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
          </button>
          <button
            onClick={() => setSelecting("to")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              selecting === "to"
                ? "bg-chicken-primary/20 text-chicken-primary border border-chicken-primary/40"
                : "bg-dark-600 text-gray-400 border border-transparent"
            }`}
          >
            <span className="text-[10px] uppercase block mb-0.5">To</span>
            {to ? new Date(to + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
          </button>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={navigatePrev} className="p-1.5 text-gray-400 hover:text-white rounded-lg active:bg-dark-600">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-white">{monthLabel}</span>
          <button onClick={navigateNext} className="p-1.5 text-gray-400 hover:text-white rounded-lg active:bg-dark-600">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] text-gray-500 font-medium py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {days.map(({ date, isCurrentMonth }, i) => {
            const dateStr = toDateStr(date);
            const isStart = isRangeStart(dateStr);
            const isEnd = isRangeEnd(dateStr);
            const inRange = isInRange(dateStr);
            const isT = dateStr === today;

            return (
              <button
                key={i}
                onClick={() => handleDayClick(dateStr)}
                className={`
                  relative h-9 text-sm font-medium rounded-lg transition-colors
                  ${!isCurrentMonth ? "text-gray-600" : "text-white"}
                  ${inRange && !isStart && !isEnd ? "bg-chicken-primary/10 text-chicken-primary" : ""}
                  ${isStart || isEnd ? "bg-chicken-primary text-dark-900 font-bold" : ""}
                  ${!inRange && isCurrentMonth ? "hover:bg-dark-500 active:bg-dark-400" : ""}
                  ${isT && !isStart && !isEnd ? "ring-1 ring-chicken-primary/50" : ""}
                `}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
