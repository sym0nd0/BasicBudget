import type {
  Income,
  Expense,
  Debt,
  SavingsGoal,
  Account,
  MonthLock,
  BudgetSummary,
  HouseholdOverview,
  DebtPayoffSummary,
  User,
  AuthStatusResponse,
  TotpSetupResponse,
  SessionInfo,
  AdminUser,
  SmtpConfig,
  OidcConfig,
  LoggingConfig,
  RegistrationConfig,
  AuditLogEntry,
  PaginatedResponse,
  VersionInfo,
} from '../types';

// ─── CSRF token management ─────────────────────────────────────────────────────

let cachedCsrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf-token', { credentials: 'include' });
  if (!res.ok) return '';
  const data = await res.json() as { token: string };
  cachedCsrfToken = data.token;
  return cachedCsrfToken;
}

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  return fetchCsrfToken();
}

export function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

// ─── Base fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (needsCsrf) {
    headers['X-CSRF-Token'] = await getCsrfToken();
  }

  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers,
    ...options,
  });

  if (res.status === 401) {
    // Clear stale CSRF token and redirect to login
    cachedCsrfToken = null;
    if (window.location.pathname !== '/login' && window.location.pathname !== '/login/2fa') {
      window.location.href = '/login';
    }
    throw Object.assign(new Error('Authentication required'), { status: 401 });
  }

  if (!res.ok) {
    // If CSRF failed, clear cached token for retry
    if (res.status === 403) cachedCsrfToken = null;

    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore parse errors
    }
    throw Object.assign(new Error(message), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── API client ────────────────────────────────────────────────────────────────

export const api = {
  // ── Auth ──
  getAuthStatus: () => request<AuthStatusResponse>('/auth/status'),
  login: (email: string, password: string) =>
    request<{ totp_required?: boolean; user?: User; household?: { id: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, display_name?: string, invite_token?: string) =>
    request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name, invite_token }),
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  verifyEmail: (token: string) =>
    request<{ message: string }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),

  // ── TOTP ──
  totpSetup: () => request<TotpSetupResponse>('/auth/totp/setup', { method: 'POST' }),
  totpVerifySetup: (token: string) =>
    request<{ recoveryCodes: string[]; message: string }>('/auth/totp/verify-setup', { method: 'POST', body: JSON.stringify({ token }) }),
  totpVerify: (token: string) =>
    request<{ user: User }>('/auth/totp/verify', { method: 'POST', body: JSON.stringify({ token }) }),
  totpVerifyRecovery: (code: string) =>
    request<{ user: User }>('/auth/totp/verify-recovery', { method: 'POST', body: JSON.stringify({ code }) }),
  totpDisable: (password: string, token?: string, code?: string) =>
    request<{ message: string }>('/auth/totp/disable', { method: 'POST', body: JSON.stringify({ password, token, code }) }),
  totpRequestReset: () =>
    request<{ message: string }>('/auth/totp/request-reset', { method: 'POST' }),

  // ── Profile ──
  getProfile: () => request<User>('/auth/profile'),
  updateProfile: (display_name: string) =>
    request<User>('/auth/profile', { method: 'PUT', body: JSON.stringify({ display_name }) }),
  updatePalette: (palette: string) =>
    request<User>('/auth/profile/palette', { method: 'PUT', body: JSON.stringify({ colour_palette: palette }) }),
  updateNotifyUpdates: (notify: boolean) =>
    request<User>('/auth/profile/notify-updates', { method: 'PUT', body: JSON.stringify({ notify_updates: notify }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // ── Sessions ──
  getSessions: () => request<SessionInfo[]>('/auth/sessions'),
  revokeSession: (sid: string) => request<void>(`/auth/sessions/${sid}`, { method: 'DELETE' }),

  // ── Invite ──
  getInviteInfo: (token: string) =>
    request<{ householdName: string; inviteeEmail: string; userExists: boolean }>(`/invite/info?token=${token}`),
  acceptInvite: (token: string) =>
    request<{ message: string; household: Record<string, unknown> }>('/household/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  // ── Household ──
  getHouseholdDetails: () => request<Record<string, unknown>>('/household'),
  updateHousehold: (name: string) =>
    request<Record<string, unknown>>('/household', { method: 'PUT', body: JSON.stringify({ name }) }),
  inviteMember: (email: string) =>
    request<{ message: string }>('/household/invite', { method: 'POST', body: JSON.stringify({ email }) }),

  // ── Incomes ──
  getIncomes: (month?: string) =>
    request<Income[]>(`/incomes${month ? `?month=${month}` : ''}`),
  createIncome: (data: Omit<Income, 'id' | 'created_at' | 'updated_at'>) =>
    request<Income>('/incomes', { method: 'POST', body: JSON.stringify(data) }),
  updateIncome: (id: string, data: Partial<Omit<Income, 'id'>>) =>
    request<Income>(`/incomes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIncome: (id: string) =>
    request<void>(`/incomes/${id}`, { method: 'DELETE' }),

  // ── Expenses ──
  getExpenses: (params?: { month?: string; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.month) qs.set('month', params.month);
    if (params?.category) qs.set('category', params.category);
    const q = qs.toString();
    return request<Expense[]>(`/expenses${q ? `?${q}` : ''}`);
  },
  createExpense: (data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) =>
    request<Expense>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: Partial<Omit<Expense, 'id'>>) =>
    request<Expense>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) =>
    request<void>(`/expenses/${id}`, { method: 'DELETE' }),

  // ── Debts ──
  getDebts: () => request<Debt[]>('/debts'),
  createDebt: (data: Omit<Debt, 'id' | 'created_at' | 'updated_at'>) =>
    request<Debt>('/debts', { method: 'POST', body: JSON.stringify(data) }),
  updateDebt: (id: string, data: Partial<Omit<Debt, 'id'>>) =>
    request<Debt>(`/debts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDebt: (id: string) =>
    request<void>(`/debts/${id}`, { method: 'DELETE' }),
  getRepayments: (id: string) =>
    request<DebtPayoffSummary>(`/debts/${id}/repayments`),

  // ── Savings Goals ──
  getSavingsGoals: () => request<SavingsGoal[]>('/savings-goals'),
  createSavingsGoal: (data: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at'>) =>
    request<SavingsGoal>('/savings-goals', { method: 'POST', body: JSON.stringify(data) }),
  updateSavingsGoal: (id: string, data: Partial<Omit<SavingsGoal, 'id'>>) =>
    request<SavingsGoal>(`/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSavingsGoal: (id: string) =>
    request<void>(`/savings-goals/${id}`, { method: 'DELETE' }),

  // ── Accounts ──
  getAccounts: () => request<Account[]>('/accounts'),
  createAccount: (data: Pick<Account, 'name' | 'sort_order'> & { is_joint?: boolean }) =>
    request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: Partial<Pick<Account, 'name' | 'sort_order'>> & { is_joint?: boolean }) =>
    request<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id: string) =>
    request<void>(`/accounts/${id}`, { method: 'DELETE' }),

  // ── Categories ──
  getCategories: () => request<string[]>('/categories'),

  // ── Month Locks ──
  getMonths: () => request<MonthLock[]>('/months'),
  lockMonth: (ym: string) =>
    request<MonthLock>(`/months/${ym}/lock`, { method: 'POST' }),
  unlockMonth: (ym: string) =>
    request<void>(`/months/${ym}/lock`, { method: 'DELETE' }),

  // ── Summary / Household ──
  getSummary: (month?: string) =>
    request<BudgetSummary>(`/summary${month ? `?month=${month}` : ''}`),
  getHousehold: (month?: string) =>
    request<HouseholdOverview>(`/household/summary${month ? `?month=${month}` : ''}`),

  // ── Export ──
  exportJson: () => fetch('/api/export/json', { credentials: 'include' }),

  // ── Admin — Users ──
  getAdminUsers: (page = 1, limit = 20) =>
    request<PaginatedResponse<AdminUser>>(`/admin/users?page=${page}&limit=${limit}`),
  getAdminUser: (id: string) =>
    request<AdminUser>(`/admin/users/${id}`),
  updateUserRole: (id: string, role: 'admin' | 'user') =>
    request<{ message: string }>(`/admin/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  lockUser: (id: string, locked: boolean) =>
    request<{ message: string }>(`/admin/users/${id}/lock`, {
      method: 'PUT',
      body: JSON.stringify({ locked }),
    }),
  deleteUser: (id: string) =>
    request<void>(`/admin/users/${id}`, { method: 'DELETE' }),

  // ── Admin — SMTP ──
  getSmtpConfig: () =>
    request<SmtpConfig>('/admin/settings/smtp'),
  updateSmtpConfig: (cfg: SmtpConfig) =>
    request<{ message: string }>('/admin/settings/smtp', {
      method: 'PUT',
      body: JSON.stringify(cfg),
    }),
  testSmtp: () =>
    request<{ message: string }>('/admin/settings/smtp/test', { method: 'POST' }),

  // ── Admin — OIDC ──
  getOidcConfig: () =>
    request<OidcConfig>('/admin/settings/oidc'),
  updateOidcConfig: (cfg: OidcConfig) =>
    request<{ message: string }>('/admin/settings/oidc', {
      method: 'PUT',
      body: JSON.stringify(cfg),
    }),

  // ── Admin — Categories ──
  getAdminCategories: () =>
    request<string[]>('/admin/settings/categories'),
  updateAdminCategories: (categories: string[]) =>
    request<{ message: string; categories: string[] }>('/admin/settings/categories', {
      method: 'PUT',
      body: JSON.stringify({ categories }),
    }),
  resetAdminCategories: () =>
    request<{ message: string; categories: string[] }>('/admin/settings/categories', { method: 'DELETE' }),

  getLoggingConfig: () =>
    request<LoggingConfig>('/admin/settings/logging'),
  updateLoggingConfig: (cfg: LoggingConfig) =>
    request<{ message: string }>('/admin/settings/logging', {
      method: 'PUT',
      body: JSON.stringify(cfg),
    }),

  getRegistrationConfig: () =>
    request<RegistrationConfig>('/admin/settings/registration'),
  updateRegistrationConfig: (cfg: RegistrationConfig) =>
    request<{ message: string }>('/admin/settings/registration', {
      method: 'PUT',
      body: JSON.stringify(cfg),
    }),
  getRegistrationStatus: () =>
    request<{ disabled: boolean }>('/auth/registration-status'),

  // ── Version ──
  getVersion: () => request<VersionInfo>('/version'),

  // ── Admin — Audit log ──
  getAuditLog: (page = 1, limit = 50, filters?: { user_id?: string; action?: string }) => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.user_id) qs.set('user_id', filters.user_id);
    if (filters?.action) qs.set('action', filters.action);
    return request<PaginatedResponse<AuditLogEntry>>(`/admin/audit-log?${qs.toString()}`);
  },
};
