import { useCart } from '../context/useCart';
import { NavCountBadge } from './NavCountBadge';

interface CartBadgeProps {
  collapsed?: boolean;
  /** Replaces the default absolute position of the collapsed bubble
   * (sidebar default: `top-1 right-2`). Used by the bottom bar to hug the icon. */
  badgeClassName?: string;
}

/**
 * Live cart item count for the "Ny bestilling" nav entry.
 * In collapsed sidebar mode it floats on the icon instead of inline.
 */
export function CartBadge({ collapsed, badgeClassName }: CartBadgeProps) {
  const { count } = useCart();
  if (collapsed) {
    return (
      <NavCountBadge
        count={count}
        size="sm"
        className={`absolute ${badgeClassName ?? 'top-1 right-2'}`}
      />
    );
  }
  return (
    <NavCountBadge
      count={count}
      className="ml-auto"
    />
  );
}
