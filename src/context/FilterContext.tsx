import React, { createContext, useContext, useState } from 'react';

interface FilterContextValue {
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  filterCategory: string;
  setFilterCategory: (cat: string) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [activeMonth, setActiveMonth] = useState<string>(currentYearMonth());
  const [filterCategory, setFilterCategory] = useState<string>('all');

  return (
    <FilterContext.Provider value={{ activeMonth, setActiveMonth, filterCategory, setFilterCategory }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
