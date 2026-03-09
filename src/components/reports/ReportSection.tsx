interface ReportSectionProps {
  title: string;
  children: React.ReactNode;
}

export function ReportSection({ title, children }: ReportSectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>
      {children}
    </div>
  );
}
