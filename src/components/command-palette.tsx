'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list'
import FolderKanban from 'lucide-react/dist/esm/icons/folder-kanban'
import SettingsIcon from 'lucide-react/dist/esm/icons/settings'
import Plus from 'lucide-react/dist/esm/icons/plus'
import SunMoon from 'lucide-react/dist/esm/icons/sun-moon'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import { useTheme } from '@/hooks/use-theme'
import { globalSearch, type SearchResult } from '@/app/(dashboard)/actions'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ projects: [], workItems: [] })
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Cmd+K 글로벌 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 헤더 버튼에서 Custom Event 수신
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('open-command-palette', handler)
    return () => window.removeEventListener('open-command-palette', handler)
  }, [])

  // 닫힐 때 상태 초기화
  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value)
    if (!value) {
      setQuery('')
      setResults({ projects: [], workItems: [] })
    }
  }, [])

  // 디바운스 검색
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (!value.trim()) {
        setResults({ projects: [], workItems: [] })
        return
      }
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          const data = await globalSearch(value)
          setResults(data)
        })
      }, 300)
    },
    []
  )

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    []
  )

  const cycleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
  }, [theme, setTheme])

  const themeLabel = theme === 'light' ? '다크 모드로 변경' : theme === 'dark' ? '시스템 테마로 변경' : '라이트 모드로 변경'

  const hasQuery = query.trim().length > 0
  const hasResults = results.projects.length > 0 || results.workItems.length > 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="커맨드 팔레트"
      description="검색하거나 명령을 실행하세요"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="검색 또는 명령어 입력..."
        value={query}
        onValueChange={handleSearch}
      />
      <CommandList>
        {hasQuery && !hasResults && !isPending && (
          <CommandEmpty>검색 결과가 없습니다</CommandEmpty>
        )}

        {hasQuery && isPending && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            검색 중...
          </div>
        )}

        {/* 검색 결과 - 프로젝트 */}
        {hasQuery && results.projects.length > 0 && (
          <CommandGroup heading="프로젝트">
            {results.projects.map((p) => (
              <CommandItem
                key={p.id}
                value={`project-${p.key}-${p.name}`}
                onSelect={() => runCommand(() => router.push(`/projects/${p.key}/alm`))}
              >
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="inline-flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium">
                    {p.key}
                  </span>
                  <span>{p.name}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 검색 결과 - 작업 */}
        {hasQuery && results.workItems.length > 0 && (
          <CommandGroup heading="작업">
            {results.workItems.map((w) => (
              <CommandItem
                key={w.id}
                value={`work-${w.project_key}-${w.number}-${w.title}`}
                onSelect={() =>
                  runCommand(() => router.push(`/projects/${w.project_key}/alm?item=${w.id}`))
                }
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex items-center gap-2 truncate">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-medium shrink-0">
                    {w.project_key}-{w.number}
                  </span>
                  <span className="truncate">{w.title}</span>
                  <span
                    className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: w.status_color }}
                  >
                    {w.status_name}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 쿼리 없을 때 - 정적 메뉴 */}
        {!hasQuery && (
          <>
            <CommandGroup heading="빠른 이동">
              <CommandItem
                value="내 작업"
                onSelect={() => runCommand(() => router.push('/my-work'))}
              >
                <ClipboardList className="h-4 w-4" />
                <span>내 작업</span>
              </CommandItem>
              <CommandItem
                value="프로젝트"
                onSelect={() => runCommand(() => router.push('/projects'))}
              >
                <FolderKanban className="h-4 w-4" />
                <span>프로젝트</span>
              </CommandItem>
              <CommandItem
                value="설정"
                onSelect={() => runCommand(() => router.push('/settings'))}
              >
                <SettingsIcon className="h-4 w-4" />
                <span>설정</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="빠른 실행">
              <CommandItem
                value="새 프로젝트"
                onSelect={() => runCommand(() => router.push('/projects?new=true'))}
              >
                <Plus className="h-4 w-4" />
                <span>새 프로젝트</span>
              </CommandItem>
              <CommandItem
                value={`테마 변경 ${themeLabel}`}
                onSelect={() => runCommand(cycleTheme)}
              >
                <SunMoon className="h-4 w-4" />
                <span>{themeLabel}</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
