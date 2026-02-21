import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { Income, Expense } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DEFAULT_INCOMES, DEFAULT_EXPENSES } from '../constants/defaults';

// ─── State ─────────────────────────────────────────────────────────────────────

interface BudgetState {
  incomes: Income[];
  expenses: Expense[];
}

// ─── Actions ───────────────────────────────────────────────────────────────────

type BudgetAction =
  | { type: 'SET_STATE'; payload: BudgetState }
  | { type: 'ADD_INCOME'; payload: Income }
  | { type: 'UPDATE_INCOME'; payload: Income }
  | { type: 'DELETE_INCOME'; payload: string }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string };

function budgetReducer(state: BudgetState, action: BudgetAction): BudgetState {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;
    case 'ADD_INCOME':
      return { ...state, incomes: [...state.incomes, action.payload] };
    case 'UPDATE_INCOME':
      return {
        ...state,
        incomes: state.incomes.map(i => i.id === action.payload.id ? action.payload : i),
      };
    case 'DELETE_INCOME':
      return { ...state, incomes: state.incomes.filter(i => i.id !== action.payload) };
    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.payload] };
    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e),
      };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };
    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface BudgetContextValue {
  state: BudgetState;
  dispatch: React.Dispatch<BudgetAction>;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

const STORAGE_KEY = 'bb-budget';

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useLocalStorage<BudgetState>(STORAGE_KEY, {
    incomes: DEFAULT_INCOMES,
    expenses: DEFAULT_EXPENSES,
  });

  const [state, dispatch] = useReducer(budgetReducer, stored);

  // Sync state → localStorage on every change
  useEffect(() => {
    setStored(state);
  }, [state, setStored]);

  return (
    <BudgetContext.Provider value={{ state, dispatch }}>
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used within BudgetProvider');
  return ctx;
}
