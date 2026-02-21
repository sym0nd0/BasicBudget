import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { Debt } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DEFAULT_DEBTS } from '../constants/defaults';

// ─── State ─────────────────────────────────────────────────────────────────────

interface DebtState {
  debts: Debt[];
}

// ─── Actions ───────────────────────────────────────────────────────────────────

type DebtAction =
  | { type: 'SET_STATE'; payload: DebtState }
  | { type: 'ADD_DEBT'; payload: Debt }
  | { type: 'UPDATE_DEBT'; payload: Debt }
  | { type: 'DELETE_DEBT'; payload: string };

function debtReducer(state: DebtState, action: DebtAction): DebtState {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;
    case 'ADD_DEBT':
      return { ...state, debts: [...state.debts, action.payload] };
    case 'UPDATE_DEBT':
      return {
        ...state,
        debts: state.debts.map(d => d.id === action.payload.id ? action.payload : d),
      };
    case 'DELETE_DEBT':
      return { ...state, debts: state.debts.filter(d => d.id !== action.payload) };
    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface DebtContextValue {
  state: DebtState;
  dispatch: React.Dispatch<DebtAction>;
}

const DebtContext = createContext<DebtContextValue | null>(null);

const STORAGE_KEY = 'bb-debts';

export function DebtProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useLocalStorage<DebtState>(STORAGE_KEY, {
    debts: DEFAULT_DEBTS,
  });

  const [state, dispatch] = useReducer(debtReducer, stored);

  useEffect(() => {
    setStored(state);
  }, [state, setStored]);

  return (
    <DebtContext.Provider value={{ state, dispatch }}>
      {children}
    </DebtContext.Provider>
  );
}

export function useDebt(): DebtContextValue {
  const ctx = useContext(DebtContext);
  if (!ctx) throw new Error('useDebt must be used within DebtProvider');
  return ctx;
}
