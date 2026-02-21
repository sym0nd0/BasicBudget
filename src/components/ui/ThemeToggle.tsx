import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../types';

const themes: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'system', label: 'System', icon: '💻' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const idx = themes.findIndex(t => t.value === theme);
    const next = themes[(idx + 1) % themes.length];
    setTheme(next.value);
  };

  const current = themes.find(t => t.value === theme) ?? themes[0];

  return (
    <button
      onClick={cycle}
      title={`Theme: ${current.label} — click to cycle`}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] transition-colors text-sm"
    >
      <span className="text-base leading-none">{current.icon}</span>
      <span className="text-xs">{current.label}</span>
    </button>
  );
}
