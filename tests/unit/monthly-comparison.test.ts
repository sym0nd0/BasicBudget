import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MonthlyComparison } from '../../src/components/reports/MonthlyComparison';
import type { MonthlyReportRow } from '../../src/types';

describe('MonthlyComparison', () => {
  it('formats comparison month labels as Mon YYYY', () => {
    const data: MonthlyReportRow[] = [
      {
        month: '2026-04',
        income_pence: 100000,
        expenses_pence: 50000,
        debt_payments_pence: 10000,
        savings_pence: 15000,
        disposable_pence: 25000,
        category_breakdown: [],
      },
      {
        month: '2026-05',
        income_pence: 110000,
        expenses_pence: 45000,
        debt_payments_pence: 9000,
        savings_pence: 16000,
        disposable_pence: 40000,
        category_breakdown: [],
      },
    ];

    const html = renderToStaticMarkup(React.createElement(MonthlyComparison, { data }));

    expect(html).toContain('May 2026');
    expect(html).toContain('vs Apr 2026');
    expect(html).not.toContain('>2026-05<');
    expect(html).not.toContain('>2026-04<');
  });
});
