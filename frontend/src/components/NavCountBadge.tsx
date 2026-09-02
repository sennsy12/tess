export type NavCountBadgeSize = 'md' | 'sm';

const SIZE_STYLES: Record<NavCountBadgeSize, string> = {
  // Default sidebar / inline bubble.
  md: 'min-w-[20px] h-5 px-1.5 text-[11px]',
  // Compact overlay bubble (bottom-bar icon, notification bell).
  sm: 'min-w-[18px] h-[18px] px-1 text-[10px] leading-none',
};

interface NavCountBadgeProps {
  count: number;
  className?: string;
  size?: NavCountBadgeSize;
}

/** Small live-count bubble; renders nothing when count is 0. */
export function NavCountBadge({ count, className = '', size = 'md' }: NavCountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-primary-600 text-white font-bold ${SIZE_STYLES[size]} ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
