"use client";

import { motion } from "framer-motion";
import { Inbox, Calendar, Users, Store, FileText, Search } from "lucide-react";

type EmptyStateType = "orders" | "calendar" | "team" | "stores" | "reports" | "search";

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const icons = {
  orders: Inbox,
  calendar: Calendar,
  team: Users,
  stores: Store,
  reports: FileText,
  search: Search,
};

const defaultContent = {
  orders: { title: "No orders yet", message: "Orders will appear here once they are created" },
  calendar: { title: "No events scheduled", message: "Your calendar is clear for this period" },
  team: { title: "No team members", message: "Add team members to get started" },
  stores: { title: "No stores found", message: "Add your first store location" },
  reports: { title: "No data available", message: "Reports will appear once you have order data" },
  search: { title: "No results found", message: "Try adjusting your search or filters" },
};

export function EmptyState({ type, title, message, action }: EmptyStateProps) {
  const Icon = icons[type];
  const content = defaultContent[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="w-20 h-20 rounded-full bg-dark-700 border border-white/5 flex items-center justify-center mb-6"
      >
        <Icon size={32} className="text-gray-500" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-lg font-semibold text-white mb-2"
      >
        {title || content.title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-400 text-sm max-w-xs"
      >
        {message || content.message}
      </motion.p>

      {action && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="mt-6 px-6 py-2.5 bg-chicken-primary text-dark-900 rounded-xl font-semibold text-sm"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}
