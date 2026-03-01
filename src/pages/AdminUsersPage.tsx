import { useState, useEffect, useCallback } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AdminUser, PaginatedResponse } from '../types';

interface AdminUsersPageProps {
  onMenuClick: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function AdminUsersPage({ onMenuClick }: AdminUsersPageProps) {
  const { user: currentUser } = useAuth();
  const [result, setResult] = useState<PaginatedResponse<AdminUser> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminUsers(p, 20);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const handleRoleChange = async (u: AdminUser, role: 'admin' | 'user') => {
    setActionError('');
    try {
      await api.updateUserRole(u.id, role);
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const handleLock = async (u: AdminUser, locked: boolean) => {
    setActionError('');
    try {
      await api.lockUser(u.id, locked);
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update lock status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    setActionError('');
    try {
      await api.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;
  const isLocked = (u: AdminUser) => !!u.locked_until && new Date(u.locked_until) > new Date();

  return (
    <PageShell title="Admin — Users" onMenuClick={onMenuClick}>
      <Card padding={false}>
        <div className="p-5 border-b border-[var(--color-border)]">
          <CardHeader
            title="User Management"
            subtitle={result ? `${result.total} user${result.total !== 1 ? 's' : ''} registered` : ''}
          />
          {actionError && (
            <p className="mt-2 text-sm text-[var(--color-danger)]">{actionError}</p>
          )}
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
                  <th className="text-center px-5 py-3">User</th>
                  <th className="text-center px-5 py-3">Role</th>
                  <th className="text-center px-5 py-3">Status</th>
                  <th className="text-center px-5 py-3">2FA</th>
                  <th className="text-center px-5 py-3">Joined</th>
                  <th className="text-center px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map(u => {
                  const isSelf = u.id === currentUser?.id;
                  const locked = isLocked(u);
                  return (
                    <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-[var(--color-text)] truncate max-w-[180px]">{u.display_name || u.email}</p>
                        <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[180px]">{u.email}</p>
                        {!u.email_verified && (
                          <span className="text-xs text-[var(--color-warning)]">Unverified</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {u.system_role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {locked ? (
                          <span className="text-xs text-[var(--color-danger)] font-medium">Locked</span>
                        ) : (
                          <span className="text-xs text-[var(--color-success)] font-medium">Active</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">
                        {u.has_totp ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-light)] text-[var(--color-success)]">Enabled</span>
                        ) : u.has_oidc ? (
                          <span className="text-xs text-[var(--color-text-muted)]">OIDC</span>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">Disabled</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--color-text-muted)]">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Role toggle */}
                          {!isSelf && (
                            <button
                              onClick={() => handleRoleChange(u, u.system_role === 'admin' ? 'user' : 'admin')}
                              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                              title={u.system_role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                            >
                              {u.system_role === 'admin' ? 'Demote' : 'Promote'}
                            </button>
                          )}
                          {/* Lock/unlock */}
                          {!isSelf && (
                            <button
                              onClick={() => handleLock(u, !locked)}
                              className={`text-xs transition-colors ${locked ? 'text-[var(--color-success)] hover:opacity-80' : 'text-[var(--color-warning)] hover:opacity-80'}`}
                              title={locked ? 'Unlock account' : 'Lock account'}
                            >
                              {locked ? 'Unlock' : 'Lock'}
                            </button>
                          )}
                          {/* Delete */}
                          {!isSelf && (
                            <button
                              onClick={() => { setDeleteTarget(u); setActionError(''); }}
                              className="text-xs text-[var(--color-danger)] hover:opacity-80 transition-colors"
                              title="Delete user"
                            >
                              Delete
                            </button>
                          )}
                          {isSelf && (
                            <span className="text-xs text-[var(--color-text-muted)] italic">You</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
      >
        <p className="text-sm text-[var(--color-text)]">
          Are you sure you want to delete <strong>{deleteTarget?.email}</strong>?
          This action is permanent and cannot be undone. All their data will be removed.
        </p>
        {actionError && <p className="mt-3 text-sm text-[var(--color-danger)]">{actionError}</p>}
        <div className="flex gap-3 justify-end mt-5">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={actionLoading}>
            {actionLoading ? 'Deleting…' : 'Delete User'}
          </Button>
        </div>
      </Modal>
    </PageShell>
  );
}
