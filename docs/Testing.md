# Testing

BasicBudget uses [Vitest](https://vitest.dev/) for unit and integration tests.

## Running Tests

```bash
npm test
```

This runs Vitest in watch mode during development. For a single run (e.g. in CI):

```bash
npm test -- --run
```

## Test Location

Tests are co-located with the source files or in `__tests__` directories:

```
src/utils/__tests__/
server/utils/__tests__/
```

## What Is Tested

| Area | What is tested |
|---|---|
| `src/utils/formatters.ts` | Pence-to-pounds formatting, `formatPercent()` |
| `src/utils/duplicates.ts` | `norm()` canonicalisation, duplicate detection logic |
| `server/utils/recurring.ts` | `filterActiveInMonth()`, weekly/fortnightly multipliers |

## Writing Tests

Tests use Vitest's `describe`/`it`/`expect` syntax:

```typescript
import { describe, it, expect } from 'vitest';
import { formatPence } from '../formatters';

describe('formatPence', () => {
  it('formats integer pence as pounds', () => {
    expect(formatPence(1050)).toBe('£10.50');
  });

  it('handles zero', () => {
    expect(formatPence(0)).toBe('£0.00');
  });
});
```

## Key Areas to Test When Contributing

- **Recurring engine changes** — verify `filterActiveInMonth` returns the correct entries for edge cases (month boundaries, weekly multipliers, fortnightly counts).
- **Money calculations** — all arithmetic must use integer pence; test with values that would produce rounding errors if floats were used.
- **Duplicate detection** — verify `norm()` handles `null`, `undefined`, empty strings, SQLite boolean integers (`0`/`1`), and string variants.

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Contributing">Contributing</a></td>
<td align="right"><a href="Release-Process">Release Process</a> &#8594;</td>
</tr>
</table>
