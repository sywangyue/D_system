"use client";

import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="mb-2">
        {icon ?? <Inbox className="w-12 h-12 text-gray-300" />}
      </div>
      <p className="text-sm text-text-secondary mt-4">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs text-accent hover:text-accent-dark underline cursor-pointer mt-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
