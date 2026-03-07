export default function PipelineLoading() {
  return (
    <div className="h-screen bg-background">
      {/* Header with controls - top area */}
      <div className="flex flex-col gap-3 p-4 border-b animate-pulse">
        {/* Top control bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-32 bg-muted rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
            <div className="h-8 w-24 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        </div>

        {/* Filter/tab section */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-12 bg-muted rounded-full relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
          <div className="h-7 w-14 bg-muted rounded-full" />
          <div className="h-7 w-16 bg-muted rounded-full" />
          <div className="ml-auto h-7 w-20 bg-muted rounded" />
        </div>
      </div>

      {/* Stats cards section */}
      <div className="grid grid-cols-4 gap-4 p-4 border-b animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg border bg-muted/20 space-y-2"
          >
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-8 w-32 bg-muted rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
          </div>
        ))}
      </div>

      {/* Main content area - Gantt or table rows */}
      <div className="flex-1 p-4 overflow-hidden animate-pulse">
        <div className="space-y-3 h-full">
          {/* Category headers and project rows */}
          {[1, 2, 3].map((category) => (
            <div key={category} className="space-y-2">
              {/* Category header row */}
              <div className="flex items-center gap-2 h-9 bg-muted/30 rounded px-3">
                <div className="h-5 w-5 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="ml-auto h-4 w-12 bg-muted rounded" />
              </div>

              {/* Project rows with gantt bars */}
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex items-center gap-3 h-12 bg-muted/20 rounded px-3"
                >
                  <div className="h-4 w-4 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                  <div className="flex-1 flex items-center gap-2">
                    <div className="h-6 w-20 bg-muted rounded" />
                    <div className="flex-1 max-w-xs h-2 bg-muted rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                  </div>
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
