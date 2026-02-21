import React from 'react';
import { Header } from './Header';

interface PageShellProps {
  title: string;
  onMenuClick: () => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function PageShell({ title, onMenuClick, headerAction, children }: PageShellProps) {
  return (
    <div className="flex flex-col h-full">
      <Header title={title} onMenuClick={onMenuClick} action={headerAction} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
