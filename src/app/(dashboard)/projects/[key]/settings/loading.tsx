export default function SettingsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* General section */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between border rounded-lg p-4">
              <div className="space-y-1 flex-1">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-64 bg-muted rounded" />
              </div>
              <div className="h-6 w-12 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Display section */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="flex items-center justify-between border rounded-lg p-4">
          <div className="space-y-1 flex-1">
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-3 w-64 bg-muted rounded" />
          </div>
          <div className="h-6 w-12 bg-muted rounded" />
        </div>
      </div>

      {/* Members section */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between border rounded-lg p-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-8 w-8 bg-muted rounded-full" />
                <div className="space-y-1 flex-1">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
              <div className="h-8 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
