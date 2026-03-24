import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { api } from '../api/client';
import { formatDateTime } from '../utils/formatters';
import type { AuditLogEntry, PaginatedResponse } from '../types';

interface AdminAuditLogPageProps {
  onMenuClick: () => void;
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function AdminAuditLogPage({ onMenuClick }: AdminAuditLogPageProps) {
  const { user } = useAuth();
  const [result, setResult] = useState<PaginatedResponse<AuditLogEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filterAction, setFilterAction] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');

  const load = useCallback(async (p: number, action: string, userId: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAuditLog(p, 50, {
        action: action || undefined,
        user_id: userId || undefined,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, filterAction, filterUserId); }, [load, page, filterAction, filterUserId]);

  const applyFilters = () => {
    setPage(1);
    setFilterAction(pendingAction);
    setFilterUserId(pendingUserId);
  };

  const clearFilters = () => {
    setPendingAction('');
    setPendingUserId('');
    setPage(1);
    setFilterAction('');
    setFilterUserId('');
  };

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;

  return (
    <PageShell title="Admin — Audit Log" onMenuClick={onMenuClick}>
      <div className="space-y-4">
        {/* Filter bar */}
        <Card>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Action filter</label>
              <input
                className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                value={pendingAction}
                onChange={e => setPendingAction(e.target.value)}
                placeholder="e.g. login_success"
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">User ID</label>
              <input
                className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                value={pendingUserId}
                onChange={e => setPendingUserId(e.target.value)}
                placeholder="uuid"
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
              />
            </div>
            <Button size="sm" onClick={applyFilters}>Filter</Button>
            {(filterAction || filterUserId) && (
              <Button size="sm" variant="secondary" onClick={clearFilters}>Clear</Button>
            )}
          </div>
        </Card>

        {/* Table */}
        <Card padding={false}>
          <div className="p-5 border-b border-[var(--color-border)]">
            <CardHeader
              title="Audit Log"
              subtitle={result ? `${result.total.toLocaleString()} entries` : ''}
            />
          </div>

          {loading ? (
            <p className="p-5 text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : error ? (
            <p className="p-5 text-sm text-[var(--color-danger)]">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="text-center px-5 py-3">Time</th>
                    <th className="text-center px-5 py-3">User</th>
                    <th className="text-center px-5 py-3">Action</th>
                    <th className="text-center px-5 py-3">Detail</th>
                    <th className="text-center px-5 py-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {result?.data.map(entry => (
                    <>
                      <tr
                        key={entry.id}
                        className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                        onClick={() => setExpandedId(prev => prev === entry.id ? null : entry.id)}
                      >
                        <td className="px-5 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap text-center">
                          {formatDateTime(entry.created_at, user)}
                        </td>
                        <td className="px-5 py-3 text-xs truncate max-w-[140px] text-center">
                          {entry.user_email ?? (entry.user_id ? entry.user_id.slice(0, 8) + '…' : '—')}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <code className="text-xs bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded text-[var(--color-primary)]">
                            {entry.action}
                          </code>
                        </td>
                        <td className="px-5 py-3 text-xs text-[var(--color-text-muted)] max-w-[200px] truncate text-center">
                          {(() => {
                            if (!entry.detail) return '—';
                            try {
                              const obj = JSON.parse(entry.detail) as Record<string, unknown>;
                              const keys = Object.keys(obj).filter(k => k !== 'ua');
                              if (keys.length === 0) return '—';
                              return keys.map(k => `${k}: ${String(obj[k])}`).join(', ');
                            } catch {
                              return truncate(entry.detail, 60);
                            }
                          })()}
                        </td>
                        <td className="px-5 py-3 text-xs text-[var(--color-text-muted)] text-center">
                          {entry.ip_address ?? '—'}
                        </td>
                      </tr>
                      {expandedId === entry.id && entry.detail && (
                        <tr key={`${entry.id}-detail`} className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                          <td colSpan={5} className="px-5 py-3 text-center">
                            {(() => {
                              try {
                                const obj = JSON.parse(entry.detail!) as Record<string, unknown>;
                                return (
                                  <div>
                                    <div className="mb-2 space-y-1">
                                      {Object.entries(obj).map(([k, v]) => (
                                        <div key={k} className="text-xs">
                                          <span className="font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{k}:</span>{' '}
                                          <span className="text-[var(--color-text)] break-all">{String(v)}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Raw JSON</summary>
                                      <pre className="mt-1 text-[var(--color-text)] whitespace-pre-wrap break-all font-mono">
                                        {JSON.stringify(obj, null, 2)}
                                      </pre>
                                    </details>
                                  </div>
                                );
                              } catch {
                                return (
                                  <pre className="text-xs text-[var(--color-text)] whitespace-pre-wrap break-all font-mono">
                                    {entry.detail}
                                  </pre>
                                );
                              }
                            })()}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]">
              <span className="text-xs text-[var(--color-text-muted)]">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
