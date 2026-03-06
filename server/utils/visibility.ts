/**
 * Visibility and permission helpers for financial entries.
 *
 * An entry is visible to a user if:
 *   - They created it (user_id === userId), OR
 *   - They are the contributor (contributor_user_id === userId), OR
 *   - It is a household entry (is_household = 1) within the same household
 *
 * An entry is modifiable by a user if:
 *   - They created it (user_id === userId), OR
 *   - They are the contributor (contributor_user_id === userId)
 */

export function filterVisible<T extends Record<string, unknown>>(
  rows: T[],
  userId: string,
): T[] {
  return rows.filter(row =>
    row.user_id === userId ||
    row.contributor_user_id === userId ||
    Boolean(row.is_household),
  );
}

export function canModify(row: Record<string, unknown>, userId: string): boolean {
  return row.user_id === userId || row.contributor_user_id === userId;
}
