import { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
}

export function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-dark-700/60 ${className}`}
    />
  );
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

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  showHeader = true,
}: TableSkeletonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        {showHeader && (
          <thead>
            <tr className="bg-dark-800/50">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="py-3 px-4">
                  <Bone className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr
              key={rowIdx}
              className={`border-t border-dark-800 ${
                rowIdx % 2 !== 0 ? 'bg-dark-800/20' : ''
              }`}
            >
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="py-3 px-4">
                  <Bone
                    className={`h-4 ${
                      colIdx === 0
                        ? 'w-10'
                        : colIdx === columns - 1
                          ? 'w-16 ml-auto'
                          : 'w-24'
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <Bone className="h-3 w-24 mb-3" />
      <Bone className="h-7 w-20" />
    </div>
  );
}

export interface ChartSkeletonProps {
  height?: string;
}

export function ChartSkeleton({ height = 'h-64' }: ChartSkeletonProps) {
  return (
    <div className="card">
      <Bone className="h-5 w-48 mb-6" />
      <div className={`${height} flex items-end gap-2 px-4`}>
        {[40, 65, 45, 80, 55, 70, 50, 75, 60, 85, 45, 70].map((_, i) => (
          <Bone
            key={i}
            className="flex-1 rounded-t"
          />
        ))}
      </div>
    </div>
  );
}

export interface CardSkeletonProps {
  lines?: number;
}

export function CardSkeleton({ lines = 3 }: CardSkeletonProps) {
  return (
    <div className="card space-y-4">
      <Bone className="h-5 w-40" />
      {Array.from({ length: lines }).map((_, i) => (
        <Bone
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export interface GridStatSkeletonProps {
  count?: number;
}

export function GridStatSkeleton({ count = 4 }: GridStatSkeletonProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-dark-800/50 p-3 rounded-lg"
        >
          <Bone className="h-3 w-16 mb-2" />
          <Bone className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

export interface ListSkeletonProps {
  count?: number;
}

export function ListSkeleton({ count = 3 }: ListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between bg-dark-800/50 p-4 rounded-lg"
        >
          <div className="space-y-2">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-20" />
          </div>
          <div className="flex items-center gap-3">
            <Bone className="h-6 w-14 rounded" />
            <Bone className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
