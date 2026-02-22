import type {
  Income,
  Expense,
  Debt,
  SavingsGoal,
  Account,
  MonthLock,
  BudgetSummary,
  HouseholdOverview,
  DebtPayoffSummary,
} from '../types';

// ─── Base fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore parse errors
    }
    const err = Object.assign(new Error(message), { status: res.status });
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── API client ────────────────────────────────────────────────────────────────

export const api = {
  // ── Incomes ──
  getIncomes: (month?: string) =>
    request<Income[]>(`/incomes${month ? `?month=${month}` : ''}`),
  createIncome: (data: Omit<Income, 'id' | 'created_at' | 'updated_at'>) =>
    request<Income>('/incomes', { method: 'POST', body: JSON.stringify(data) }),
  updateIncome: (id: string, data: Partial<Omit<Income, 'id'>>) =>
    request<Income>(`/incomes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIncome: (id: string) =>
    request<void>(`/incomes/${id}`, { method: 'DELETE' }),

  // ── Expenses ──
  getExpenses: (params?: { month?: string; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.month) qs.set('month', params.month);
    if (params?.category) qs.set('category', params.category);
    const q = qs.toString();
    return request<Expense[]>(`/expenses${q ? `?${q}` : ''}`);
  },
  createExpense: (data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) =>
    request<Expense>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: Partial<Omit<Expense, 'id'>>) =>
    request<Expense>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) =>
    request<void>(`/expenses/${id}`, { method: 'DELETE' }),

  // ── Debts ──
  getDebts: () => request<Debt[]>('/debts'),
  createDebt: (data: Omit<Debt, 'id' | 'created_at' | 'updated_at'>) =>
    request<Debt>('/debts', { method: 'POST', body: JSON.stringify(data) }),
  updateDebt: (id: string, data: Partial<Omit<Debt, 'id'>>) =>
    request<Debt>(`/debts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDebt: (id: string) =>
    request<void>(`/debts/${id}`, { method: 'DELETE' }),
  getAmortisation: (id: string) =>
    request<DebtPayoffSummary>(`/debts/${id}/amortisation`),

  // ── Savings Goals ──
  getSavingsGoals: () => request<SavingsGoal[]>('/savings-goals'),
  createSavingsGoal: (data: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at'>) =>
    request<SavingsGoal>('/savings-goals', { method: 'POST', body: JSON.stringify(data) }),
  updateSavingsGoal: (id: string, data: Partial<Omit<SavingsGoal, 'id'>>) =>
    request<SavingsGoal>(`/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSavingsGoal: (id: string) =>
    request<void>(`/savings-goals/${id}`, { method: 'DELETE' }),

  // ── Accounts ──
  getAccounts: () => request<Account[]>('/accounts'),
  createAccount: (data: Pick<Account, 'name' | 'sort_order'>) =>
    request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: Partial<Pick<Account, 'name' | 'sort_order'>>) =>
    request<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id: string) =>
    request<void>(`/accounts/${id}`, { method: 'DELETE' }),

  // ── Month Locks ──
  getMonths: () => request<MonthLock[]>('/months'),
  lockMonth: (ym: string) =>
    request<MonthLock>(`/months/${ym}/lock`, { method: 'POST' }),
  unlockMonth: (ym: string) =>
    request<void>(`/months/${ym}/lock`, { method: 'DELETE' }),

  // ── Summary / Household ──
  getSummary: (month?: string) =>
    request<BudgetSummary>(`/summary${month ? `?month=${month}` : ''}`),
  getHousehold: (month?: string) =>
    request<HouseholdOverview>(`/household${month ? `?month=${month}` : ''}`),

  // ── Export ──
  exportJson: () => fetch('/api/export/json'),
};
