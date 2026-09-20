import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  /**
   * Executive Dark illustration (see `components/emptyStates`) — takes
   * precedence over `icon` when set. Purely decorative: the wrapper is
   * aria-hidden and the title carries the meaning for assistive tech.
   */
  illustration?: ReactNode;
}

export function EmptyState({ title, description, action, icon, illustration }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {illustration ? (
        <div className="empty-illo mb-5 w-40 max-w-full" aria-hidden>
          {illustration}
        </div>
      ) : (
        <div className="mb-4 rounded-full bg-dark-800 p-4 text-dark-400" aria-hidden>
          {icon ?? <Inbox className="h-8 w-8" />}
        </div>
      )}
      <h3 className="text-lg font-semibold text-dark-100">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-dark-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
