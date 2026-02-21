import { useState, useMemo } from 'react';
import { useDebt } from '../context/DebtContext';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { DebtForm } from '../components/forms/DebtForm';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatPercent, formatMonths, formatYearMonth } from '../utils/formatters';
import { amortizeAllDebts } from '../utils/calculations';
import type { Debt, AmortizationRow } from '../types';
import { DebtPayoffChart } from '../components/charts/DebtPayoffLine';

interface DebtPageProps {
  onMenuClick: () => void;
}

export function DebtPage({ onMenuClick }: DebtPageProps) {
  const { state, dispatch } = useDebt();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summaries = useMemo(() => amortizeAllDebts(state.debts), [state.debts]);

  const totalBalance = state.debts.reduce((s, d) => s + d.balance, 0);
  const totalPayments = state.debts.reduce((s, d) => s + d.currentPayment, 0);
  const totalInterest = summaries.reduce((s, summary) => s + summary.totalInterestPaid, 0);
  const maxMonths = summaries.reduce((m, s) => Math.max(m, s.monthsToPayoff), 0);

  const handleSave = (debt: Debt) => {
    if (editing) {
      dispatch({ type: 'UPDATE_DEBT', payload: debt });
    } else {
      dispatch({ type: 'ADD_DEBT', payload: debt });
    }
    setModalOpen(false);
    setEditing(undefined);
  };

  const handleEdit = (debt: Debt) => {
    setEditing(debt);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this debt?')) {
      dispatch({ type: 'DELETE_DEBT', payload: id });
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
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Debt</p>
          <p className="text-2xl font-bold text-[var(--color-danger)]">{formatCurrency(totalBalance)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Monthly Payments</p>
          <p className="text-2xl font-bold text-[var(--color-warning)]">{formatCurrency(totalPayments)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Interest</p>
          <p className="text-2xl font-bold text-[var(--color-text)]">{formatCurrency(totalInterest)}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Debt-Free In</p>
          <p className="text-2xl font-bold text-[var(--color-primary)]">{formatMonths(maxMonths)}</p>
        </Card>
      </div>

      {/* Chart */}
      {state.debts.length > 0 && (
        <div className="mb-5">
          <DebtPayoffChart summaries={summaries} />
        </div>
      )}

      {/* Debt table */}
      <Card padding={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Debt Tracker"
            subtitle={`${state.debts.length} debt${state.debts.length !== 1 ? 's' : ''} — click a row to view amortization`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Name</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Balance</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">APR</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Payment/mo</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Payoff</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Interest</th>
                <th className="px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {state.debts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[var(--color-text-muted)]">
                    No debts tracked yet.
                  </td>
                </tr>
              )}
              {state.debts.map(debt => {
                const summary = summaries.find(s => s.debtId === debt.id);
                const isExpanded = expandedId === debt.id;

                return (
                  <>
                    <tr
                      key={debt.id}
                      className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-2)] cursor-pointer"
                      onClick={() => toggleExpand(debt.id)}
                    >
                      <td className="px-5 py-3 font-medium text-[var(--color-text)]">
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          {debt.name}
                          {debt.apr > 0 && (
                            <Badge variant="danger" className="text-[10px]">Interest</Badge>
                          )}
                        </div>
                        {debt.notes && (
                          <p className="text-xs text-[var(--color-text-muted)] ml-6 mt-0.5">{debt.notes}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-[var(--color-danger)]">
                        {formatCurrency(debt.balance)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {debt.apr > 0 ? (
                          <Badge variant="danger">{formatPercent(debt.apr)}</Badge>
                        ) : (
                          <Badge variant="success">0%</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--color-warning)]">
                        {formatCurrency(debt.currentPayment)}
                      </td>
                      <td className="px-5 py-3 text-right text-[var(--color-text-muted)]">
                        {summary ? (
                          debt.currentPayment > 0
                            ? <span title={summary.payoffDate}>{formatMonths(summary.monthsToPayoff)}</span>
                            : <span className="text-[var(--color-danger)]">No payment</span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--color-text-muted)]">
                        {summary ? formatCurrency(summary.totalInterestPaid) : '—'}
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
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

                    {/* Amortization schedule */}
                    {isExpanded && summary && (
                      <tr key={`${debt.id}-schedule`} className="border-t border-[var(--color-border)]">
                        <td colSpan={7} className="px-5 py-4 bg-[var(--color-surface-2)]">
                          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                            Amortization Schedule — {summary.monthsToPayoff} payments, {formatCurrency(summary.totalInterestPaid)} interest
                          </p>
                          <div className="overflow-x-auto max-h-64">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-[var(--color-surface-2)]">
                                <tr>
                                  <th className="text-left py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">#</th>
                                  <th className="text-left py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Date</th>
                                  <th className="text-right py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Opening</th>
                                  <th className="text-right py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Interest</th>
                                  <th className="text-right py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Payment</th>
                                  <th className="text-right py-1.5 pr-4 font-semibold text-[var(--color-text-muted)]">Principal</th>
                                  <th className="text-right py-1.5 font-semibold text-[var(--color-text-muted)]">Closing</th>
                                </tr>
                              </thead>
                              <tbody>
                                {summary.schedule.map((row: AmortizationRow) => (
                                  <tr key={row.month} className="border-t border-[var(--color-border)]">
                                    <td className="py-1.5 pr-4 text-[var(--color-text-muted)]">{row.month}</td>
                                    <td className="py-1.5 pr-4 text-[var(--color-text-muted)]">{formatYearMonth(row.date)}</td>
                                    <td className="py-1.5 pr-4 text-right font-mono text-[var(--color-text)]">{formatCurrency(row.openingBalance)}</td>
                                    <td className="py-1.5 pr-4 text-right font-mono text-[var(--color-danger)]">{formatCurrency(row.interestCharge)}</td>
                                    <td className="py-1.5 pr-4 text-right font-mono text-[var(--color-warning)]">{formatCurrency(row.payment)}</td>
                                    <td className="py-1.5 pr-4 text-right font-mono text-[var(--color-success)]">{formatCurrency(row.principalPaid)}</td>
                                    <td className="py-1.5 text-right font-mono text-[var(--color-text)]">{formatCurrency(row.closingBalance)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        title={editing ? 'Edit Debt' : 'Add Debt'}
      >
        <DebtForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(undefined); }}
        />
      </Modal>
    </PageShell>
  );
}
