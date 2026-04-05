# AGENTS.md

Frontend guidance for `src/`.

- Follow the existing React and Tailwind patterns. Do not introduce a new styling approach.
- In `src/`, use `import.meta.env`. Do not use `process.env`.
- Use the existing formatter utilities for money and dates.
- Display percentages with `formatPercent()`.
- Percentage inputs must use `step="0.01"`.
- On the Household page, show household-only data.
- For month-scoped "New" badges, use the item's first relevant month instead of only checking the previous month.
- For month-scoped expense comparisons, use `effective_pence` when present.
- Recharts tooltips must use `cursor={false}`.
