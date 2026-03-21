import React, { createContext, useContext, useCallback } from 'react';
import type { Debt } from '../types';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';

// ─── Context Value ─────────────────────────────────────────────────────────────

interface DebtContextValue {
  debts: Debt[];
  loading: boolean;
  addDebt: (data: Omit<Debt, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDebt: (id: string, data: Partial<Omit<Debt, 'id'>>) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  refetchDebts: () => void;
}

const DebtContext = createContext<DebtContextValue | null>(null);

export function DebtProvider({ children }: { children: React.ReactNode }) {
  const { data: debts, loading, refetch: refetchDebts } = useApi<Debt[]>('/debts');

  const addDebt = useCallback(async (data: Omit<Debt, 'id' | 'created_at' | 'updated_at'>) => {
    await api.createDebt(data);
    refetchDebts();
  }, [refetchDebts]);

  const updateDebt = useCallback(async (id: string, data: Partial<Omit<Debt, 'id'>>) => {
    await api.updateDebt(id, data);
    refetchDebts();
  }, [refetchDebts]);

  const deleteDebt = useCallback(async (id: string) => {
    await api.deleteDebt(id);
    refetchDebts();
  }, [refetchDebts]);

  return (
    <DebtContext.Provider
      value={{
        debts: debts ?? [],
        loading,
        addDebt,
        updateDebt,
        deleteDebt,
        refetchDebts,
      }}
    >
      {children}
    </DebtContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDebt(): DebtContextValue {
  const ctx = useContext(DebtContext);
  if (!ctx) throw new Error('useDebt must be used within DebtProvider');
  return ctx;
}
