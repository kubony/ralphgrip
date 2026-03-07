'use client'

import Check from 'lucide-react/dist/esm/icons/check'
import Moon from 'lucide-react/dist/esm/icons/moon'
import Sun from 'lucide-react/dist/esm/icons/sun'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/use-theme'

type ThemeMode = 'light' | 'dark' | 'system'

const COLOR_TOKENS = [
  { label: 'Background', cssVar: '--background' },
  { label: 'Foreground', cssVar: '--foreground' },
  { label: 'Primary', cssVar: '--primary' },
  { label: 'Primary Foreground', cssVar: '--primary-foreground' },
  { label: 'Secondary', cssVar: '--secondary' },
  { label: 'Secondary Foreground', cssVar: '--secondary-foreground' },
  { label: 'Muted', cssVar: '--muted' },
  { label: 'Muted Foreground', cssVar: '--muted-foreground' },
  { label: 'Card', cssVar: '--card' },
  { label: 'Card Foreground', cssVar: '--card-foreground' },
  { label: 'Border', cssVar: '--border' },
  { label: 'Ring', cssVar: '--ring' },
  { label: 'Destructive', cssVar: '--destructive' },
  { label: 'Sidebar', cssVar: '--sidebar' },
  { label: 'Sidebar Foreground', cssVar: '--sidebar-foreground' },
]

const TYPO_SAMPLES = [
  { label: 'Display', className: 'text-4xl font-semibold tracking-tight', text: 'Design System' },
  { label: 'Title', className: 'text-2xl font-semibold', text: 'Token-first UI' },
  { label: 'Body', className: 'text-base', text: 'Consistent visual language across pages.' },
  { label: 'Subtle', className: 'text-sm text-muted-foreground', text: 'Use semantic tokens, avoid ad-hoc color values.' },
]

export function DesignSystemShowcase() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const activeThemeLabel = theme === 'system' ? `system (${resolvedTheme})` : theme

  const themeModes: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon },
    { mode: 'system', label: 'System', icon: Check },
  ]

  return (
    <div className="h-full overflow-auto bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
        <section className="rounded-2xl border bg-card p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Worvk</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Design System</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Live preview of theme tokens currently applied in this app.
              </p>
            </div>

            <div className="rounded-xl border bg-background/70 p-2 backdrop-blur-sm">
              <p className="mb-2 px-2 text-xs text-muted-foreground">Theme: {activeThemeLabel}</p>
              <div className="flex items-center gap-1">
                {themeModes.map((item) => {
                  const Icon = item.icon
                  const active = theme === item.mode
                  return (
                    <Button
                      key={item.mode}
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'ghost'}
                      className={cn('gap-1.5', !active && 'text-muted-foreground')}
                      onClick={() => setTheme(item.mode)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Color Tokens</CardTitle>
            <CardDescription>Semantic tokens mapped from CSS variables in globals.css</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COLOR_TOKENS.map((token) => (
                <div key={token.cssVar} className="rounded-xl border bg-background p-3">
                  <div
                    className="mb-3 h-12 rounded-md border"
                    style={{ backgroundColor: `var(${token.cssVar})` }}
                    aria-label={`${token.label} preview`}
                  />
                  <p className="text-sm font-medium">{token.label}</p>
                  <p className="text-xs text-muted-foreground">{token.cssVar}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>Current type scale and semantic text usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {TYPO_SAMPLES.map((sample) => (
                <div key={sample.label} className="rounded-lg border bg-background p-4">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{sample.label}</p>
                  <p className={sample.className}>{sample.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buttons and Glass</CardTitle>
              <CardDescription>Interactive states and translucent surfaces</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>

              <div className="relative overflow-hidden rounded-xl border bg-background/60 p-5 backdrop-blur-md">
                <div className="pointer-events-none absolute inset-0 bg-primary/10" />
                <div className="relative">
                  <p className="text-sm font-medium">Glass Surface</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Uses semantic tokens with blur and translucency.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
