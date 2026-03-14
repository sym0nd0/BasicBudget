import React, { createContext, useContext, useCallback } from 'react';
import type { SavingsGoal, SavingsTransaction, SavingsTransactionType } from '../types';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';

interface SavingsContextValue {
  goals: SavingsGoal[];
  loading: boolean;
  addGoal: (data: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateGoal: (id: string, data: Partial<Omit<SavingsGoal, 'id'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  createTransaction: (goalId: string, data: { type: SavingsTransactionType; amount_pence: number; notes?: string | null }) => Promise<SavingsTransaction>;
  refetchGoals: () => void;
}

const SavingsContext = createContext<SavingsContextValue | null>(null);

export function SavingsProvider({ children }: { children: React.ReactNode }) {
  const { data: goals, loading, refetch: refetchGoals } = useApi<SavingsGoal[]>('/savings-goals');

  const addGoal = useCallback(async (data: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at'>) => {
    await api.createSavingsGoal(data);
    refetchGoals();
  }, [refetchGoals]);

  const updateGoal = useCallback(async (id: string, data: Partial<Omit<SavingsGoal, 'id'>>) => {
    await api.updateSavingsGoal(id, data);
    refetchGoals();
  }, [refetchGoals]);

  const deleteGoal = useCallback(async (id: string) => {
    await api.deleteSavingsGoal(id);
    refetchGoals();
  }, [refetchGoals]);

  const createTransaction = useCallback(async (goalId: string, data: { type: SavingsTransactionType; amount_pence: number; notes?: string | null }) => {
    const tx = await api.createSavingsTransaction(goalId, data);
    refetchGoals();
    return tx;
  }, [refetchGoals]);

  return (
    <SavingsContext.Provider value={{ goals: goals ?? [], loading, addGoal, updateGoal, deleteGoal, createTransaction, refetchGoals }}>
      {children}
    </SavingsContext.Provider>
  );
}

export function useSavings(): SavingsContextValue {
  const ctx = useContext(SavingsContext);
  if (!ctx) throw new Error('useSavings must be used within SavingsProvider');
  return ctx;
}
