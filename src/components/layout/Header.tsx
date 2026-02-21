interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  action?: React.ReactNode;
}

export function Header({ title, onMenuClick, action }: HeaderProps) {
  return (
    <header className="h-16 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center px-4 gap-4">
      {/* Hamburger (mobile only) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
        aria-label="Open navigation"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="text-lg font-semibold text-[var(--color-text)] flex-1">{title}</h1>

      {action && <div>{action}</div>}
    </header>
  );
}
