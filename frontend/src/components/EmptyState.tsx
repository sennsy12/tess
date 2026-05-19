import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4 rounded-full bg-dark-800 p-4 text-dark-400" aria-hidden>
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <h3 className="text-lg font-semibold text-dark-100">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-dark-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
