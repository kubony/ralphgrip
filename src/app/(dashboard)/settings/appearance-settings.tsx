'use client'

import { useTheme } from '@/hooks/use-theme'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Sun from 'lucide-react/dist/esm/icons/sun'
import Moon from 'lucide-react/dist/esm/icons/moon'
import Monitor from 'lucide-react/dist/esm/icons/monitor'

const themes = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
]

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <section id="appearance">
      <h2 className="text-base font-semibold mb-4">Appearance</h2>
      <div className="space-y-3">
        <Label className="text-sm">테마</Label>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-muted',
                theme === t.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              )}
            >
              <t.icon className={cn(
                'h-5 w-5',
                theme === t.value ? 'text-primary' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-sm',
                theme === t.value ? 'font-medium text-primary' : 'text-muted-foreground'
              )}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
