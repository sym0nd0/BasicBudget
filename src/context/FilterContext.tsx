import React, { createContext, useContext, useState } from 'react';
import type { ReportRange } from '../types';
import { resolveRange } from '../utils/reportRanges';

interface FilterContextValue {
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  filterCategory: string;
  setFilterCategory: (cat: string) => void;
  fromMonth: string;
  toMonth: string;
  setFromMonth: (month: string) => void;
  setToMonth: (month: string) => void;
  isRangeActive: boolean;
  rangeMonths: string[];
  rangePreset: ReportRange;
  setRangePreset: (preset: ReportRange) => void;
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
  const initial = currentYearMonth();
  const [rangePreset, setRangePresetState] = useState<ReportRange>('1m');
  const [fromMonth, setFromMonthState] = useState<string>(initial);
  const [toMonth, setToMonthState] = useState<string>(initial);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const isRangeActive = fromMonth !== toMonth;
  const rangeMonths = monthsBetween(fromMonth, toMonth);
  const activeMonth = fromMonth;

  const setRangePreset = (preset: ReportRange) => {
    setRangePresetState(preset);
    if (preset !== 'custom') {
      const { from, to } = resolveRange(preset);
      setFromMonthState(from);
      setToMonthState(to);
    }
  };

  const setActiveMonth = (month: string) => {
    setRangePresetState('1m');
    setFromMonthState(month);
    setToMonthState(month);
  };

  const setFromMonth = (month: string) => {
    setFromMonthState(month);
  };

  const setToMonth = (month: string) => {
    setToMonthState(month);
  };

  return (
    <FilterContext.Provider value={{
      activeMonth,
      setActiveMonth,
      filterCategory,
      setFilterCategory,
      fromMonth,
      toMonth,
      setFromMonth,
      setToMonth,
      isRangeActive,
      rangeMonths,
      rangePreset,
      setRangePreset,
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
