import { Badge } from './Badge';

export function NewItemBadge() {
  return (
    <span className="relative inline-flex">
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full ring-2 ring-[var(--color-warning)] animate-pulse"
      />
      <Badge
        variant="warning"
        className="relative text-[10px] font-bold ring-2 ring-[var(--color-warning)] shadow-[0_0_14px_color-mix(in_srgb,var(--color-warning)_60%,transparent)]"
      >
        New
      </Badge>
    </span>
  );
}
