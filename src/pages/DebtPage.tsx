import { useState, Fragment } from 'react';
import { useDebt } from '../context/DebtContext';
import { useFilter } from '../context/FilterContext';
import { useApi } from '../hooks/useApi';
import { PageShell } from '../components/layout/PageShell';
import { FilterBar } from '../components/layout/FilterBar';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { DebtForm } from '../components/forms/DebtForm';
import { Badge } from '../components/ui/Badge';
import { DeltaIndicator } from '../components/ui/DeltaIndicator';
import { SortableHeader } from '../components/ui/SortableHeader';
import { useSortableTable } from '../hooks/useSortableTable';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { DebtBalanceChart } from '../components/charts/DebtBalanceChart';
import { formatCurrency, formatPercent, formatYearMonth } from '../utils/formatters';
import { findDuplicateDebt } from '../utils/duplicates';
import { addMonthsToYM } from '../utils/reportRanges';
import type { Debt, RepaymentRow, DebtPayoffSummary } from '../types';

interface DebtPageProps {
  onMenuClick: () => void;
}

/** Inline repayment schedule fetch per expanded debt */
function RepaymentPanel({ debtId }: { debtId: string }) {
  const { data: summary } = useApi<DebtPayoffSummary>(`/debts/${debtId}/repayments`);

  if (!summary) {
    return <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>;
  }

  return (
    <>
      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
        Repayment Schedule — {summary.monthsToPayoff} payments, {formatCurrency(summary.totalInterestPaidPence)} interest
      </p>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[var(--color-surface-2)]">
            <tr>
              <th className="text-center py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">#</th>
              <th className="text-center py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Date</th>
              <th className="text-center py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Opening</th>
              <th className="text-center py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Interest</th>
              <th className="text-center py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Payment</th>
              <th className="text-center py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Principal</th>
              <th className="text-center py-1.5 font-semibold text-[var(--color-text-muted)]">Closing</th>
            </tr>
          </thead>
          <tbody>
            {summary.schedule.map((row: RepaymentRow) => (
              <tr key={row.month} className="border-t border-[var(--color-border)]">
                <td className="py-1.5 pr-4 text-[var(--color-text-muted)] text-center">{row.month}</td>
                <td className="py-1.5 pr-4 text-[var(--color-text-muted)] text-center">{formatYearMonth(row.date)}</td>
                <td className="py-1.5 pr-4 font-mono text-[var(--color-text)] text-center">{formatCurrency(row.opening_balance_pence)}</td>
                <td className="py-1.5 pr-4 font-mono text-[var(--color-danger)] text-center">{formatCurrency(row.interest_charge_pence)}</td>
                <td className="py-1.5 pr-4 font-mono text-[var(--color-warning)] text-center">{formatCurrency(row.payment_pence)}</td>
                <td className="py-1.5 pr-4 font-mono text-[var(--color-success)] text-center">{formatCurrency(row.principal_paid_pence)}</td>
                <td className="py-1.5 font-mono text-[var(--color-text)] text-center">{formatCurrency(row.closing_balance_pence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function isDebtActiveThisMonth(debt: Debt, yearMonth?: string): boolean {
  let monthStart: Date, monthEnd: Date;
  if (yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number);
    monthStart = new Date(y, m - 1, 1);
    monthEnd = new Date(y, m, 0);
  } else {
    const now = new Date();
    monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  const parseDate = (d: string | null | undefined): Date | null => {
    if (!d) return null;
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
  };

  const startDate = parseDate(debt.start_date);
  const endDate = parseDate(debt.end_date);

  if (!debt.is_recurring) {
    if (!startDate) return false;
    return startDate >= monthStart && startDate <= monthEnd;
  }

  if (startDate && startDate > monthEnd) return false;
  if (endDate && endDate < monthStart) return false;
  return true;
}

export function DebtPage({ onMenuClick }: DebtPageProps) {
  const { addDebt, updateDebt, deleteDebt } = useDebt();
  const { activeMonth } = useFilter();
  const prevMonth = addMonthsToYM(activeMonth, -1);

  const { data: currentMonthDebts, refetch: refetchCurrentDebts } = useApi<Debt[]>(`/debts?month=${activeMonth}`);
  const { data: prevMonthDebts } = useApi<Debt[]>(`/debts?month=${prevMonth}`);

  const debts = currentMonthDebts ?? [];
  const { sorted: sortedDebts, sortKey, sortDir, toggleSort } = useSortableTable<Debt>(debts, 'name');
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalBalance = debts.reduce((s, d) => s + d.balance_pence, 0);
  const totalPayments = debts
    .filter(d => isDebtActiveThisMonth(d))
    .reduce((s, d) => s + Math.round((d.minimum_payment_pence + d.overpayment_pence) * d.split_ratio), 0);
  const totalInterestDebts = debts.filter(d => d.interest_rate > 0).length;

  const prevDebts = prevMonthDebts ?? [];
  const prevTotalBalance = prevDebts.reduce((s, d) => s + d.balance_pence, 0);
  const prevTotalPayments = prevDebts
    .filter(d => isDebtActiveThisMonth(d, prevMonth))
    .reduce((s, d) => s + Math.round((d.minimum_payment_pence + (d.overpayment_pence ?? 0)) * (d.split_ratio ?? 1)), 0);

  const handleSave = async (data: Omit<Debt, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editing) {
      const dup = findDuplicateDebt(debts, data);
      if (dup && !await confirm('Duplicate Debt', 'A debt with identical details already exists. Add anyway?')) return;
    }
    try {
      if (editing) {
        await updateDebt(editing.id, data);
      } else {
        await addDebt(data);
      }
      refetchCurrentDebts();
      setModalOpen(false);
      setEditing(undefined);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleEdit = (debt: Debt) => {
    setEditing(debt);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('Delete Debt', 'Delete this debt?', 'danger')) return;
    try {
      await deleteDebt(id);
      refetchCurrentDebts();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <PageShell
      title="Debt"
      onMenuClick={onMenuClick}
      headerAction={
        <Button onClick={handleAdd} size="sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Debt
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="mb-5">
        <Card>
          <FilterBar />
        </Card>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5 items-stretch">
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Debt</p>
          <p className="text-2xl font-bold text-[var(--color-danger)]">{formatCurrency(totalBalance)}</p>
          <DeltaIndicator
            current={totalBalance}
            previous={prevMonthDebts ? prevTotalBalance : null}
            semantics="positive-down"
          />
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Monthly Payments</p>
          <p className="text-2xl font-bold text-[var(--color-warning)]">{formatCurrency(totalPayments)}</p>
          <DeltaIndicator
            current={totalPayments}
            previous={prevMonthDebts ? prevTotalPayments : null}
            semantics="positive-down"
          />
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Debts</p>
          <p className="text-2xl font-bold text-[var(--color-text)]">{debts.length}</p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Interest Debts</p>
          <p className="text-2xl font-bold text-[var(--color-primary)]">{totalInterestDebts}</p>
        </Card>
      </div>

      {/* Debt balance projection chart */}
      {debts.length > 0 && (
        <div className="mb-5">
          <DebtBalanceChart />
        </div>
      )}

      {/* Debt table */}
      <Card padding={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Debt Tracker"
            subtitle={`${debts.length} debt${debts.length !== 1 ? 's' : ''} — click a row to view repayments`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] group">
                <SortableHeader label="Name" sortKey="name" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof Debt)} />
                <SortableHeader label="Balance" sortKey="balance_pence" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof Debt)} />
                <SortableHeader label="APR" sortKey="interest_rate" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof Debt)} />
                <SortableHeader label="Min Payment" sortKey="minimum_payment_pence" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof Debt)} />
                <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Overpayment</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Your Share</th>
                <th className="text-center px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {debts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[var(--color-text-muted)]">
                    No debts tracked yet.
                  </td>
                </tr>
              )}
              {sortedDebts.map(debt => {
                const isExpanded = expandedId === debt.id;
                const isActive = isDebtActiveThisMonth(debt);

                return (
                  <Fragment key={debt.id}>
                    <tr
                      className={`border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-2)] cursor-pointer${!isActive ? ' opacity-50' : ''}`}
                      onClick={() => toggleExpand(debt.id)}
                    >
                      <td className="px-5 py-3 font-medium text-[var(--color-text)] text-center">
                        <div className="flex items-center justify-center gap-2">
                          <svg
                            className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          {debt.name}
                          {debt.is_household && (
                            <Badge variant="primary" className="text-[10px]">½</Badge>
                          )}
                          {debt.deal_periods && debt.deal_periods.length > 0 && (
                            <Badge variant="info" className="text-[10px]">{debt.deal_periods.length} rates</Badge>
                          )}
                          {debt.interest_rate > 0 && (
                            <Badge variant="danger" className="text-[10px]">Interest</Badge>
                          )}
                        </div>
                        {debt.notes && (
                          <p className="text-xs text-[var(--color-text-muted)] ml-6 mt-0.5">{debt.notes}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono font-semibold text-[var(--color-danger)] text-center">
                        {formatCurrency(debt.balance_pence)}
                        <DeltaIndicator
                          current={debt.balance_pence}
                          previous={prevMonthDebts ? (prevDebts.find(p => p.id === debt.id)?.balance_pence ?? null) : null}
                          semantics="positive-down"
                        />
                      </td>
                      <td className="px-5 py-3 text-center">
                        {debt.interest_rate > 0 ? (
                          <Badge variant="danger">{formatPercent(debt.interest_rate)}</Badge>
                        ) : (
                          <Badge variant="success">0%</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-[var(--color-warning)] text-center">
                        {formatCurrency(debt.minimum_payment_pence)}
                      </td>
                      <td className="px-5 py-3 font-mono text-[var(--color-text-muted)] text-center">
                        {debt.overpayment_pence > 0 ? formatCurrency(debt.overpayment_pence) : '—'}
                      </td>
                      <td className="px-5 py-3 font-mono font-semibold text-[var(--color-warning)] text-center">
                        {formatCurrency(Math.round((debt.minimum_payment_pence + debt.overpayment_pence) * debt.split_ratio))}
                      </td>
                      <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-center">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(debt)}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(debt.id)}
                            className="hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Repayment schedule */}
                    {isExpanded && (
                      <tr className="border-t border-[var(--color-border)]">
                        <td colSpan={7} className="px-5 py-4 bg-[var(--color-surface-2)]">
                          {(debt.reminder_months ?? 0) > 0 && (
                            <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                              <span>Reminder enabled: {debt.reminder_months} month{debt.reminder_months !== 1 ? 's' : ''} before deal period ends</span>
                            </div>
                          )}

                          {/* Deal periods table */}
                          {debt.deal_periods && debt.deal_periods.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Deal Periods</p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-[var(--color-surface)]">
                                    <th className="text-center px-2 py-1 text-[var(--color-text-muted)]">Period</th>
                                    <th className="text-center px-2 py-1 text-[var(--color-text-muted)]">Rate</th>
                                    <th className="text-center px-2 py-1 text-[var(--color-text-muted)]">From</th>
                                    <th className="text-center px-2 py-1 text-[var(--color-text-muted)]">Until</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {debt.deal_periods.map((period) => (
                                    <tr key={period.id} className="border-t border-[var(--color-border)]">
                                      <td className="px-2 py-1 text-[var(--color-text)] text-center">{period.label || '—'}</td>
                                      <td className="px-2 py-1 font-mono text-[var(--color-text)] text-center">{formatPercent(period.interest_rate)}</td>
                                      <td className="px-2 py-1 font-mono text-[var(--color-text-muted)] text-xs text-center">{period.start_date}</td>
                                      <td className="px-2 py-1 font-mono text-[var(--color-text-muted)] text-xs text-center">{period.end_date ? period.end_date : 'ongoing'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          <RepaymentPanel debtId={debt.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {/* Totals row */}
              {debts.length > 0 && (
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3 font-semibold text-[var(--color-text)] text-center">Total ({debts.length})</td>
                  <td className="px-5 py-3 font-mono font-bold text-[var(--color-danger)] text-center">{formatCurrency(totalBalance)}</td>
                  <td className="text-center"></td>
                  <td className="px-5 py-3 font-mono text-[var(--color-warning)] text-center">{formatCurrency(debts.reduce((s, d) => s + d.minimum_payment_pence, 0))}</td>
                  <td className="px-5 py-3 font-mono text-[var(--color-text-muted)] text-center">{formatCurrency(debts.reduce((s, d) => s + d.overpayment_pence, 0))}</td>
                  <td className="px-5 py-3 font-mono font-bold text-[var(--color-warning)] text-center">{formatCurrency(totalPayments)}</td>
                  <td className="text-center"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {ConfirmDialogElement}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); setErrorMsg(null); }}
        title={editing ? 'Edit Debt' : 'Add Debt'}
        maxWidth="max-w-xl"
      >
        {errorMsg && (
          <p className="mb-3 text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}
        <DebtForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(undefined); setErrorMsg(null); }}
        />
      </Modal>
    </PageShell>
  );
}
