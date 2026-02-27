// Re-export all shared types for frontend use
export type {
  Account,
  Income,
  Expense,
  ExpenseCategory,
  Debt,
  SavingsGoal,
  MonthLock,
  RepaymentRow,
  DebtPayoffSummary,
  CategoryBreakdown,
  BudgetSummary,
  HouseholdOverview,
  Theme,
  // Auth types
  User,
  Household,
  HouseholdMember,
  HouseholdRole,
  SystemRole,
  SessionInfo,
  LoginRequest,
  RegisterRequest,
  TotpSetupResponse,
  AuthStatusResponse,
  // Admin types
  AdminUser,
  SmtpConfig,
  OidcConfig,
  AuditLogEntry,
  PaginatedResponse,
} from '../../shared/types';

export { EXPENSE_CATEGORIES } from '../../shared/types';
