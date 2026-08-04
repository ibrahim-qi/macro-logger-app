import React from 'react';

interface SkeletonProps {
  className?: string;
  soft?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', soft = true }) => (
  <div className={`skeleton ${soft ? 'skeleton--soft' : ''} ${className}`} aria-hidden="true" />
);

export const TodayPageSkeleton: React.FC = () => (
  <div className="today-page space-y-6 animate-fade-in" aria-busy="true" aria-label="Loading today">
    <nav className="today-date">
      <Skeleton className="h-9 w-9 rounded-full" />
      <Skeleton className="h-4 w-36 rounded-full flex-1 max-w-[9rem] mx-auto" />
      <Skeleton className="h-9 w-9 rounded-full" />
    </nav>

    <section className="today-summary space-y-4">
      <Skeleton className="h-16 w-24 rounded-xl mx-auto" />
      <Skeleton className="h-3 w-8 rounded-full mx-auto" />
      <Skeleton className="h-0.5 w-full max-w-[10rem] mx-auto rounded-full" />
      <Skeleton className="h-3 w-28 rounded-full mx-auto" />
      <div className="flex justify-center gap-5 pt-1">
        <Skeleton className="h-4 w-10 rounded-full" />
        <Skeleton className="h-4 w-10 rounded-full" />
        <Skeleton className="h-4 w-10 rounded-full" />
      </div>
      <Skeleton className="h-3 w-40 rounded-full mx-auto mt-2" />
      <Skeleton className="h-10 w-32 rounded-full mx-auto" />
    </section>

    <div className="segment-tabs segment-tabs--minimal">
      <Skeleton className="h-4 w-12 rounded-full mx-auto" />
      <Skeleton className="h-4 w-14 rounded-full mx-auto" />
    </div>

    <div className="space-y-3">
      <Skeleton className="h-4 w-16 rounded-full" />
      <Skeleton className="h-[5rem] w-full rounded-2xl" />
      <Skeleton className="h-[5rem] w-full rounded-2xl" />
    </div>
  </div>
);
