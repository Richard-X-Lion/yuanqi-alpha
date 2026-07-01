'use client';

import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  accentColor: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  accentColor,
  defaultOpen = false,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-terminal-border/30 bg-terminal-card overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-terminal-border/5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-bold text-foreground">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="text-terminal-muted text-xs">{isOpen ? '▼' : '▶'}</span>
        </div>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
