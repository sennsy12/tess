import { useCart } from '../context/useCart';
import { NavCountBadge } from './NavCountBadge';

interface CartBadgeProps {
  collapsed?: boolean;
}

/**
 * Live cart item count for the "Ny bestilling" nav entry.
 * In collapsed sidebar mode it floats on the icon instead of inline.
 */
export function CartBadge({ collapsed }: CartBadgeProps) {
  const { count } = useCart();
  if (collapsed) {
    if (count <= 0) return null;
    return (
      <span
        className="absolute top-1 right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold leading-none"
        aria-label={`${count} varer i handlekurven`}
      >
        {count > 99 ? '99+' : count}
      </span>
    );
  }
  return (
    <NavCountBadge
      count={count}
      className="ml-auto"
    />
  );
}
