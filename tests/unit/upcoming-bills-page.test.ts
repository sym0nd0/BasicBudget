import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpcomingBillsReportResponse } from '../../src/types';

const mockState = vi.hoisted(() => ({
  data: null as UpcomingBillsReportResponse | null,
  loading: false,
  error: null as Error | null,
  urls: [] as string[],
}));

vi.mock('../../src/hooks/useApi', () => ({
  useApi: (url: string | null) => {
    mockState.urls.push(url ?? '');
    return {
      data: mockState.data,
      loading: mockState.loading,
      error: mockState.error,
      refetch: vi.fn(),
    };
  },
}));

describe('UpcomingBillsPage', () => {
  beforeEach(() => {
    mockState.data = null;
    mockState.loading = false;
    mockState.error = null;
    mockState.urls = [];
  });

  it('renders loading state', async () => {
    mockState.loading = true;
    const { UpcomingBillsPage } = await import('../../src/pages/UpcomingBillsPage');

    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, null, React.createElement(UpcomingBillsPage, { onMenuClick: vi.fn() })),
    );

    expect(html).toContain('Loading upcoming bills');
  });

  it('renders empty state when the month has no outgoing bills', async () => {
    mockState.data = {
      month: '2026-05',
      summary: {
        total_count: 0,
        total_pence: 0,
        past_due_count: 0,
        past_due_pence: 0,
        due_today_count: 0,
        due_today_pence: 0,
        upcoming_count: 0,
        upcoming_pence: 0,
      },
      occurrences: [],
    };
    const { UpcomingBillsPage } = await import('../../src/pages/UpcomingBillsPage');

    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, null, React.createElement(UpcomingBillsPage, { onMenuClick: vi.fn() })),
    );

    expect(html).toContain('No upcoming bills for this month.');
  });

  it('renders summary cards and calendar content without overdue wording', async () => {
    mockState.data = {
      month: '2026-05',
      summary: {
        total_count: 2,
        total_pence: 60900,
        past_due_count: 1,
        past_due_pence: 900,
        due_today_count: 0,
        due_today_pence: 0,
        upcoming_count: 1,
        upcoming_pence: 60000,
      },
      occurrences: [
        {
          id: 'expense-exp-1-2026-05-02',
          source: 'expense',
          source_id: 'exp-1',
          name: 'Streaming',
          due_date: '2026-05-02',
          amount_pence: 900,
          is_household: false,
          category: 'Subscriptions',
          recurrence_type: 'monthly',
          status: 'past_due_date',
        },
        {
          id: 'expense-exp-2-2026-05-31',
          source: 'expense',
          source_id: 'exp-2',
          name: 'Rent',
          due_date: '2026-05-31',
          amount_pence: 60000,
          is_household: true,
          category: 'Housing',
          recurrence_type: 'monthly',
          status: 'upcoming',
        },
      ],
    };
    const { UpcomingBillsPage } = await import('../../src/pages/UpcomingBillsPage');

    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, null, React.createElement(UpcomingBillsPage, { onMenuClick: vi.fn() })),
    );

    expect(html).toContain('Total Bills');
    expect(html).toContain('£609.00');
    expect(html).toContain('Past due date');
    expect(html).toContain('Streaming');
    expect(html).toContain('Rent');
    expect(html).toContain('Calendar');
    expect(html).toContain('List');
    expect(html).not.toContain('Overdue');
  });
});
