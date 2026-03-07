export default function ProjectLoading() {
  return (
    <div className="flex h-screen bg-background">
      {/* Header skeleton */}
      <div className="fixed inset-0 top-0 h-16 border-b bg-background z-40">
        <div className="h-full flex items-center px-4 gap-4">
          <div className="h-8 w-32 bg-muted rounded relative overflow-hidden animate-pulse before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Main content - 3 column layout */}
      <div className="pt-16 flex flex-1 gap-4 p-4">
        {/* Left panel - Tree skeleton */}
        <div className="w-72 border rounded-lg bg-muted/30 p-4 space-y-2 animate-pulse">
          <div className="h-5 w-24 bg-muted rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-5 w-5 bg-muted rounded" />
                <div className="h-4 flex-1 bg-muted rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
              </div>
            ))}
          </div>
        </div>

        {/* Center panel - Document skeleton */}
        <div className="flex-1 border rounded-lg bg-muted/10 p-4 space-y-3 animate-pulse">
          <div className="h-8 w-48 bg-muted rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-muted rounded w-full relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
            ))}
          </div>
          <div className="h-32 bg-muted rounded mt-4 relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
        </div>

        {/* Right panel - Properties skeleton */}
        <div className="w-72 border rounded-lg bg-muted/30 p-4 space-y-3 animate-pulse">
          <div className="h-5 w-20 bg-muted rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-8 bg-muted rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
