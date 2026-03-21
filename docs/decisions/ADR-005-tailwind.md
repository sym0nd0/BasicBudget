# ADR-005: Tailwind CSS 4 via Vite Plugin

**Date:** 2024-01-01
**Status:** Accepted

---

## Context

BasicBudget needed a CSS strategy that supports rapid UI development, dark mode, and a consistent design system across all pages. The team prioritised utility-first styling over component library adoption to maintain full control over the visual design.

## Decision

We chose **Tailwind CSS 4** integrated via the official **`@tailwindcss/vite`** Vite plugin. There is no `tailwind.config.js` — Tailwind 4's new engine uses a CSS-first configuration approach with `@theme` blocks in the main CSS file.

All UI styling uses Tailwind utility classes directly on JSX elements. Custom CSS is prohibited unless there is genuinely no utility equivalent. This enforces consistency and prevents style drift across the codebase.

Dark mode is handled via the `dark:` variant, controlled by a class on `<html>`.

## Consequences

**Positive:**
- Utility-first approach keeps styling co-located with markup — no context switching to a separate stylesheet
- Tailwind 4's Vite plugin replaces PostCSS; no additional configuration needed
- Dark mode support is built in via `dark:` variants
- JIT mode (always on in v4) means only used utilities are generated — zero dead CSS in production

**Negative / trade-offs:**
- Long class strings on complex components can be hard to read
- Tailwind 4 API differs from v3 — some class names have changed; documentation must be read carefully
- No PostCSS means some v3 plugins are incompatible

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| CSS Modules | Would fragment styles into many files; harder to build a consistent design system |
| styled-components / Emotion | CSS-in-JS adds runtime overhead and complexity; SSR compatibility concerns |
| A component library (MUI, Radix) | Would impose a visual design we cannot control; custom component patterns are already established |
| Plain CSS | Lacks systematic design token enforcement; global scope causes specificity conflicts |
