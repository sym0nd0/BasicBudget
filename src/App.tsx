import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { FilterProvider } from './context/FilterContext';
import { BudgetProvider } from './context/BudgetContext';
import { DebtProvider } from './context/DebtContext';
import { SavingsProvider } from './context/SavingsContext';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { IncomePage } from './pages/IncomePage';
import { ExpensesPage } from './pages/ExpensesPage';
import { DebtPage } from './pages/DebtPage';
import { SavingsPage } from './pages/SavingsPage';
import { HouseholdPage } from './pages/HouseholdPage';
import { SettingsPage } from './pages/SettingsPage';

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
          <Route path="/savings" element={<SavingsPage onMenuClick={() => setSidebarOpen(true)} />} />
          <Route path="/household" element={<HouseholdPage onMenuClick={() => setSidebarOpen(true)} />} />
          <Route path="/settings" element={<SettingsPage onMenuClick={() => setSidebarOpen(true)} />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <FilterProvider>
        <BudgetProvider>
          <DebtProvider>
            <SavingsProvider>
              <BrowserRouter>
                <AppShell />
              </BrowserRouter>
            </SavingsProvider>
          </DebtProvider>
        </BudgetProvider>
      </FilterProvider>
    </ThemeProvider>
  );
}
