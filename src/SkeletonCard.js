import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-8 relative overflow-hidden">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-800/20 to-transparent" />
      
      {/* Company name skeleton */}
      <div className="h-3 bg-zinc-900 rounded w-48 mb-6 animate-pulse" />
      
      {/* Ticker and price skeleton */}
      <div className="flex gap-8 mb-8">
        <div className="h-16 bg-zinc-900 rounded w-32 animate-pulse" />
        <div className="flex flex-col gap-2">
          <div className="h-12 bg-zinc-900 rounded w-40 animate-pulse" />
          <div className="h-8 bg-zinc-900 rounded w-32 animate-pulse" />
        </div>
      </div>
      
      {/* Metrics grid skeleton */}
      <div className="grid grid-cols-3 gap-12 border-t-2 border-zinc-900 pt-8 mb-10">
        <div>
          <div className="h-2 bg-zinc-900 rounded w-16 mb-2 animate-pulse" />
          <div className="h-6 bg-zinc-900 rounded w-24 animate-pulse" />
        </div>
        <div>
          <div className="h-2 bg-zinc-900 rounded w-16 mb-2 animate-pulse" />
          <div className="h-6 bg-zinc-900 rounded w-24 animate-pulse" />
        </div>
        <div>
          <div className="h-2 bg-zinc-900 rounded w-16 mb-2 animate-pulse" />
          <div className="h-6 bg-zinc-900 rounded w-32 animate-pulse" />
        </div>
      </div>
      
      {/* Progress bars skeleton */}
      <div className="space-y-8">
        <div>
          <div className="h-2 bg-zinc-900 rounded w-32 mb-3 animate-pulse" />
          <div className="h-1 bg-zinc-900 rounded w-full animate-pulse" />
        </div>
        <div>
          <div className="h-2 bg-zinc-900 rounded w-32 mb-3 animate-pulse" />
          <div className="h-1 bg-zinc-900 rounded w-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}