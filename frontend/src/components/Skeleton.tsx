import { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
}

export function Skeleton({ className = '', variant = 'rectangular', ...props }: SkeletonProps) {
  const baseClasses = 'shimmer bg-dark-800/50 rounded-lg backdrop-blur-sm border border-dark-700/20';
  
  const variantClasses = {
    rectangular: 'w-full h-full',
    circular: 'rounded-full',
    text: 'h-4 w-3/4 rounded-md',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
