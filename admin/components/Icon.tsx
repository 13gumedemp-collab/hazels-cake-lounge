const PATHS: Record<string, React.ReactNode> = {
  home: <path d="M4 11l8-7 8 7M6 10v9h12v-9" />,
  calendar: <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  kanban: <><rect x="4" y="4" width="5" height="16" rx="1" /><rect x="11" y="4" width="5" height="10" rx="1" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0M16 6a3 3 0 010 6M21 20a6 6 0 00-4-5.6" /></>,
  whatsapp: <path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3zM8.5 8.5c.3-.7.6-.7.9-.7h.6c.2 0 .4 0 .6.5l.7 1.7c0 .2 0 .4-.1.6l-.5.6c-.1.2-.2.3 0 .6.6 1 .1.5 1.3 1.6.3.2.6.2.8.1l.7-.5c.2-.2.5-.1.6 0l1.5.8c.2.1.3.2.3.6 0 .9-.7 1.7-1.5 1.8-.7 0-1.6.3-4.3-1.6-2-1.6-2.6-3.4-2.7-3.7-.1-.3-.6-1.2-.6-2.2 0-1 .4-1.5.6-1.7z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  bell: <path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M10 21a2 2 0 004 0" />,
  chart: <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
  logout: <path d="M14 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2v-2M9 12h11M17 9l3 3-3 3" />,
};

export default function Icon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      {PATHS[name] ?? null}
    </svg>
  );
}
