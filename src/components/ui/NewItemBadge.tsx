import { Badge } from './Badge';

export function NewItemBadge() {
  return (
    <span className="relative inline-flex">
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full ring-2 ring-[var(--color-info)]/35 animate-pulse"
      />
      <Badge
        variant="info"
        className="relative text-[10px] font-semibold ring-1 ring-[var(--color-info)]/45 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-info)_12%,transparent)]"
      >
        New
      </Badge>
    </span>
  );
}
