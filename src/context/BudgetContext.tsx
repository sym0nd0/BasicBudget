import React, { createContext, useContext, useCallback } from 'react';
import type { Income, Expense, Account } from '../types';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { useFilter } from './FilterContext';

// ─── Context Value ─────────────────────────────────────────────────────────────

interface BudgetContextValue {
  incomes: Income[];
  expenses: Expense[];
  accounts: Account[];
  loading: boolean;
  addIncome: (data: Omit<Income, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateIncome: (id: string, data: Partial<Omit<Income, 'id'>>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  addExpense: (data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateExpense: (id: string, data: Partial<Omit<Expense, 'id'>>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addAccount: (data: Pick<Account, 'name' | 'sort_order'> & { is_joint?: boolean }) => Promise<void>;
  updateAccount: (id: string, data: Partial<Pick<Account, 'name' | 'sort_order'>> & { is_joint?: boolean }) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  refetchIncomes: () => void;
  refetchExpenses: () => void;
  refetchAccounts: () => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const { activeMonth } = useFilter();

  const {
    data: incomes,
    loading: incomesLoading,
    refetch: refetchIncomes,
  } = useApi<Income[]>(`/incomes?month=${activeMonth}`);

  const {
    data: expenses,
    loading: expensesLoading,
    refetch: refetchExpenses,
  } = useApi<Expense[]>(`/expenses?month=${activeMonth}`);

  const {
    data: accounts,
    loading: accountsLoading,
    refetch: refetchAccounts,
  } = useApi<Account[]>('/accounts');

  const addIncome = useCallback(async (data: Omit<Income, 'id' | 'created_at' | 'updated_at'>) => {
    await api.createIncome(data);
    refetchIncomes();
  }, [refetchIncomes]);

  const updateIncome = useCallback(async (id: string, data: Partial<Omit<Income, 'id'>>) => {
    await api.updateIncome(id, data);
    refetchIncomes();
  }, [refetchIncomes]);

  const deleteIncome = useCallback(async (id: string) => {
    await api.deleteIncome(id);
    refetchIncomes();
  }, [refetchIncomes]);

  const addExpense = useCallback(async (data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
    await api.createExpense(data);
    refetchExpenses();
  }, [refetchExpenses]);

  const updateExpense = useCallback(async (id: string, data: Partial<Omit<Expense, 'id'>>) => {
    await api.updateExpense(id, data);
    refetchExpenses();
  }, [refetchExpenses]);

  const deleteExpense = useCallback(async (id: string) => {
    await api.deleteExpense(id);
    refetchExpenses();
  }, [refetchExpenses]);

  const addAccount = useCallback(async (data: Pick<Account, 'name' | 'sort_order'>) => {
    await api.createAccount(data);
    refetchAccounts();
  }, [refetchAccounts]);

  const updateAccount = useCallback(async (id: string, data: Partial<Pick<Account, 'name' | 'sort_order'>>) => {
    await api.updateAccount(id, data);
    refetchAccounts();
  }, [refetchAccounts]);

  const deleteAccount = useCallback(async (id: string) => {
    await api.deleteAccount(id);
    refetchAccounts();
    refetchExpenses();
  }, [refetchAccounts, refetchExpenses]);

  return (
    <BudgetContext.Provider
      value={{
        incomes: incomes ?? [],
        expenses: expenses ?? [],
        accounts: accounts ?? [],
        loading: incomesLoading || expensesLoading || accountsLoading,
        addIncome,
        updateIncome,
        deleteIncome,
        addExpense,
        updateExpense,
        deleteExpense,
        addAccount,
        updateAccount,
        deleteAccount,
        refetchIncomes,
        refetchExpenses,
        refetchAccounts,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used within BudgetProvider');
  return ctx;
}
