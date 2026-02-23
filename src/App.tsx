import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { FilterProvider } from './context/FilterContext';
import { BudgetProvider } from './context/BudgetContext';
import { DebtProvider } from './context/DebtContext';
import { SavingsProvider } from './context/SavingsContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { IncomePage } from './pages/IncomePage';
import { ExpensesPage } from './pages/ExpensesPage';
import { DebtPage } from './pages/DebtPage';
import { SavingsPage } from './pages/SavingsPage';
import { HouseholdPage } from './pages/HouseholdPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TotpPage } from './pages/TotpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <FilterProvider>
      <BudgetProvider>
        <DebtProvider>
          <SavingsProvider>
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
          </SavingsProvider>
        </DebtProvider>
      </BudgetProvider>
    </FilterProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/2fa" element={<TotpPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            {/* Protected routes */}
            <Route path="/*" element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
