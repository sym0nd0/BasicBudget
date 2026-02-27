import React, { createContext, useContext, useState } from 'react';

interface FilterContextValue {
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  filterCategory: string;
  setFilterCategory: (cat: string) => void;
  fromMonth: string | null;
  toMonth: string | null;
  setFromMonth: (month: string | null) => void;
  setToMonth: (month: string | null) => void;
  isRangeActive: boolean;
  rangeMonths: string[];
  rangeIndex: number;
  setRangeIndex: (i: number) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(from: string, to: string): string[] {
  const result: string[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [activeMonth, setActiveMonth] = useState<string>(currentYearMonth());
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [fromMonth, setFromMonth] = useState<string | null>(null);
  const [toMonth, setToMonth] = useState<string | null>(null);
  const [rangeIndex, setRangeIndex] = useState<number>(0);

  const isRangeActive = Boolean(fromMonth && toMonth && fromMonth <= toMonth);
  const rangeMonths = isRangeActive ? monthsBetween(fromMonth!, toMonth!) : [];

  // When range is active, activeMonth reflects the current position in range
  const effectiveMonth = isRangeActive ? (rangeMonths[rangeIndex] ?? rangeMonths[0]) : activeMonth;

  const handleSetActiveMonth = (month: string) => {
    setActiveMonth(month);
  };

  const handleSetFromMonth = (month: string | null) => {
    setFromMonth(month);
    setRangeIndex(0);
  };

  const handleSetToMonth = (month: string | null) => {
    setToMonth(month);
    setRangeIndex(0);
  };

  return (
    <FilterContext.Provider value={{
      activeMonth: effectiveMonth,
      setActiveMonth: handleSetActiveMonth,
      filterCategory,
      setFilterCategory,
      fromMonth,
      toMonth,
      setFromMonth: handleSetFromMonth,
      setToMonth: handleSetToMonth,
      isRangeActive,
      rangeMonths,
      rangeIndex,
      setRangeIndex,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
