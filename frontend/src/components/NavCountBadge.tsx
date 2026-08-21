interface NavCountBadgeProps {
  count: number;
  className?: string;
}

/** Small live-count bubble; renders nothing when count is 0. */
export function NavCountBadge({ count, className = '' }: NavCountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[11px] font-bold leading-none ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
