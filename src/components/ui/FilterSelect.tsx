"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}

export default function FilterSelect({ value, options, onChange, icon }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex-1 min-w-0 flex items-center justify-between gap-1.5 bg-dark-700 border border-dark-500 text-white px-3 py-2.5 rounded-xl text-sm font-medium active:scale-[0.97] transition-transform"
      >
        <span className="flex items-center gap-1.5 truncate">
          {icon}
          <span className="truncate">{selectedLabel}</span>
        </span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="w-full max-w-md bg-dark-800 rounded-t-2xl overflow-hidden safe-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-dark-500" />
              </div>

              <div className="px-4 py-3 space-y-1">
                {options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <motion.button
                      key={option.value}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-base font-medium transition-colors ${
                        isSelected
                          ? "bg-chicken-primary/15 text-chicken-primary"
                          : "text-white active:bg-dark-600"
                      }`}
                    >
                      <span>{option.label}</span>
                      {isSelected && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", damping: 15, stiffness: 300 }}
                        >
                          <Check size={20} className="text-chicken-primary" />
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <div className="px-4 pb-4 pt-1">
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-3.5 rounded-xl bg-dark-600 text-gray-300 text-base font-medium active:bg-dark-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
