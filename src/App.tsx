import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BudgetProvider } from './context/BudgetContext';
import { DebtProvider } from './context/DebtContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { IncomePage } from './pages/IncomePage';
import { ExpensesPage } from './pages/ExpensesPage';
import { DebtPage } from './pages/DebtPage';

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard onMenuClick={() => setSidebarOpen(true)} />} />
          <Route path="/income" element={<IncomePage onMenuClick={() => setSidebarOpen(true)} />} />
          <Route path="/expenses" element={<ExpensesPage onMenuClick={() => setSidebarOpen(true)} />} />
          <Route path="/debt" element={<DebtPage onMenuClick={() => setSidebarOpen(true)} />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BudgetProvider>
        <DebtProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </DebtProvider>
      </BudgetProvider>
    </ThemeProvider>
  );
}
