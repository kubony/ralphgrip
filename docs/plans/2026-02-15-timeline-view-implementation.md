# Timeline View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** RalphGrip에 5번째 뷰로 타임라인(간트차트)을 추가하여 work_items의 시간적 구조를 시각화한다.

**Architecture:** 단일 스크롤 컨테이너 + CSS sticky로 좌측 항목 리스트 / 상단 시간축 헤더를 고정. 간트 바는 div 기반으로 자체 구현. 바 드래그는 네이티브 pointer events. 기존 filteredWorkItems, useALMSelection, useWorkItemFilters 훅을 100% 재사용.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, date-fns (신규), @tanstack/react-virtual (신규)

**Design Doc:** `docs/plans/2026-02-15-timeline-view-design.md`

---

## Task 1: 의존성 설치

**Files:**
- Modify: `package.json`

**Step 1: date-fns 및 @tanstack/react-virtual 설치**

```bash
pnpm add date-fns @tanstack/react-virtual
```

**Step 2: 설치 확인**

```bash
pnpm ls date-fns @tanstack/react-virtual
```

Expected: 두 패키지 모두 표시됨

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add date-fns and @tanstack/react-virtual for timeline view"
```

---

## Task 2: use-timeline-state 훅 생성

타임라인의 핵심 상태 관리 훅. 줌 레벨, 날짜<->픽셀 변환, 뷰포트 범위 계산.

**Files:**
- Create: `src/hooks/use-timeline-state.ts`

**Step 1: 훅 구현**

핵심 내용:
- `ZoomLevel` = `'day' | 'week' | 'month'`
- 줌별 셀 너비: day=40px, week=120px(7일), month=160px(30일)
- `pxPerDay` 계산: day=40, week≈17.14, month≈5.33
- `dateToX(date, rangeStart)` -- rangeStart로부터의 일 수 차이 * pxPerDay
- `xToDate(x, rangeStart)` -- 역변환 (드래그용)
- `dateRange` 계산: filteredWorkItems에서 start_date/due_date의 min/max + 양쪽 2주 여유
- date-fns 사용: `differenceInCalendarDays`, `addDays`, `subDays`, `min`, `max`, `parseISO`, `startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`, `eachDayOfInterval`, `eachWeekOfInterval`, `eachMonthOfInterval`, `isWeekend`, `isSameDay`, `format`

입력: `filteredWorkItems: WorkItemWithRelations[]`
출력: `{ zoomLevel, setZoomLevel, pxPerDay, dateToX, xToDate, dateRange, totalWidth, headerDates }`

**참고 파일:**
- `src/hooks/use-work-item-filters.ts` -- 훅 구조 패턴
- `src/types/database.ts:74` -- `WorkItemWithRelations` 타입 (start_date, due_date 포함은 WorkItemRow에서)

**주의사항:**
- `new Date("2026-02-15")`는 UTC로 파싱됨. date-fns의 `parseISO`를 사용하거나 `"2026-02-15T00:00:00"` 형식으로 변환
- 날짜가 모두 null인 경우: 오늘 기준 전후 3개월을 기본 범위로

**Step 2: Commit**

```bash
git add src/hooks/use-timeline-state.ts
git commit -m "feat: add use-timeline-state hook for timeline zoom and date<->px conversion"
```

---

## Task 3: timeline-view.tsx 기본 레이아웃

진입점 컴포넌트. 단일 스크롤 컨테이너 + CSS sticky 구조.

**Files:**
- Create: `src/components/projects/timeline-view.tsx`

**Step 1: 컴포넌트 구현**

Props 인터페이스 (ListView 패턴 참고: `src/components/projects/list-view.tsx:19-26`):
```typescript
interface TimelineViewProps {
  projectId: string
  projectKey: string
  workItems: WorkItemWithRelations[]
  statuses: StatusRef[]
  trackers: TrackerRef[]
  members: PersonRef[]
  selection: Selection
  onSelectionChange: (sel: Selection) => void
  showTrackerId?: boolean
}
```

레이아웃 구조:
```
<div className="h-full flex flex-col">
  {/* 줌 컨트롤 바 */}
  <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 border-b">
    줌 버튼 (Day/Week/Month) + "오늘로 이동" 버튼
  </div>

  {/* 메인 간트 영역 (단일 스크롤) */}
  <div className="flex-1 overflow-auto relative">
    {/* CSS Grid: 4 quadrants */}
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', width: totalWidth + 250 }}>
      {/* 좌상단 코너: sticky top+left, z-30 */}
      <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 30 }}>코너</div>
      {/* 시간축 헤더: sticky top, z-20 */}
      <TimelineHeader ... />
      {/* 항목 리스트: sticky left, z-10 */}
      <div style={{ position: 'sticky', left: 0, zIndex: 10 }}>
        {scheduledItems.map(item => <TimelineRowLabel ... />)}
      </div>
      {/* 간트 바 영역 */}
      <div style={{ position: 'relative' }}>
        <TimelineGrid ... /> {/* 배경 */}
        {scheduledItems.map(item => <TimelineBar ... />)}
      </div>
    </div>

    {/* 미배정 섹션 */}
    {unscheduledItems.length > 0 && <TimelineUnscheduled ... />}
  </div>

  {/* 속성 오버레이 */}
  {selectedWorkItem && <TimelinePropertyOverlay ... />}
</div>
```

데이터 분류 (useMemo):
- `scheduledItems`: start_date 또는 due_date가 있는 항목 (계층 순서 유지)
- `unscheduledItems`: 둘 다 null인 항목

계층 평탄화 (useMemo):
- `useWorkItemFilters`의 `levelMap` 패턴 참고
- parent_id 기반으로 DFS 순회하여 flat list 생성
- 접기/펼치기 상태: `expandedIds: Set<string>` (useState)
- 접힌 부모의 자식은 flat list에서 제외

**참고 파일:**
- `src/components/projects/list-view.tsx:19-26` -- props 패턴
- `src/components/projects/graph-view.tsx:282-294` -- pointer event 패턴
- `src/hooks/use-work-item-filters.ts:40-61` -- levelMap 계산

**Step 2: alm-layout.tsx 통합**

Modify: `src/components/projects/alm-layout.tsx`

변경 사항:
1. line 60: `ViewMode` 타입에 `'timeline'` 추가
2. line 61: `VALID_VIEW_MODES`에 `'timeline'` 추가
3. line 56-58 근처: `const TimelineView = dynamic(() => import('./timeline-view'), { ssr: false })` 추가
4. line 25-41 근처: `import GanttChart from 'lucide-react/dist/esm/icons/gantt-chart'` 추가 (lucide에 있는지 확인, 없으면 `CalendarRange` 사용)
5. line 242 (Graph 버튼 뒤): Timeline 버튼 추가

```tsx
<button
  onClick={() => setViewMode('timeline')}
  className={cn(
    'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
    viewMode === 'timeline'
      ? 'bg-background text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground'
  )}
  title="타임라인"
  aria-label="타임라인"
>
  <GanttChart className="h-3.5 w-3.5" />
  Timeline
</button>
```

6. line 571-589 (graph 분기 뒤): timeline 렌더링 분기 추가

기존의 `viewMode === 'graph'` 분기를 `else if` 체인으로 변경:
```tsx
) : viewMode === 'graph' ? (
  ... 기존 graph 코드 ...
) : viewMode === 'timeline' ? (
  <div className="h-full overflow-hidden">
    <TimelineView
      projectId={projectId}
      projectKey={projectKey}
      workItems={filteredWorkItems}
      statuses={statuses}
      trackers={trackers}
      members={members}
      selection={selection}
      onSelectionChange={setSelection}
      showTrackerId={showTrackerId}
    />
  </div>
) : null}
```

**주의**: 현재 graph가 마지막 else로 처리되어 있음. timeline을 추가하면 else if 체인으로 변경 필요.

**Step 3: Commit**

```bash
git add src/components/projects/timeline-view.tsx src/components/projects/alm-layout.tsx
git commit -m "feat: add timeline-view skeleton and integrate into alm-layout view switcher"
```

---

## Task 4: timeline-header.tsx 시간축 헤더

2단 시간축 헤더. 줌 레벨에 따라 월+일 / 월+주 / 년+월 표시.

**Files:**
- Create: `src/components/projects/timeline-header.tsx`

**Step 1: 구현**

Props:
```typescript
interface TimelineHeaderProps {
  dateRange: { start: Date; end: Date }
  zoomLevel: ZoomLevel
  pxPerDay: number
  dateToX: (date: Date) => number
  totalWidth: number
}
```

구조:
- 상단 행: 월/년 라벨 (해당 월의 시작 X ~ 끝 X 범위에 걸치는 셀)
- 하단 행: 일/주 라벨 (줌에 따라)
  - Day 줌: 각 날짜 숫자 (1, 2, 3... / 셀 너비 40px)
  - Week 줌: "W7", "2/10" 등 (셀 너비 120px)
  - Month 줌: 하단 행 생략 또는 주 번호

date-fns 사용:
- `eachMonthOfInterval` -> 상단 월 셀 생성
- `eachDayOfInterval` / `eachWeekOfInterval` -> 하단 셀 생성
- `format(date, 'yyyy년 M월')`, `format(date, 'd')`, `format(date, 'M/d')`
- `isWeekend(date)` -> 주말 셀 스타일링

스타일:
- `position: sticky; top: 0; z-index: 20`
- `bg-background border-b`
- 하단 셀: 주말이면 `bg-muted/30`

**Step 2: Commit**

```bash
git add src/components/projects/timeline-header.tsx
git commit -m "feat: add timeline-header with dual-row time axis (month+day/week)"
```

---

## Task 5: timeline-grid.tsx 배경 그리드 + 오늘 마커

배경 그리드선과 주말 음영, 오늘 표시선.

**Files:**
- Create: `src/components/projects/timeline-grid.tsx`

**Step 1: 구현**

Props:
```typescript
interface TimelineGridProps {
  dateRange: { start: Date; end: Date }
  zoomLevel: ZoomLevel
  pxPerDay: number
  dateToX: (date: Date) => number
  totalWidth: number
  rowCount: number
  rowHeight: number
}
```

구현 방식 -- DOM 최소화:
- 전체 배경: CSS `repeating-linear-gradient`로 세로 그리드선 (pxPerDay 간격)
- 주말 음영: 주말 날짜 위치에 절대 위치 `div` (bg-muted/20)
  - Day 줌에서만 개별 주말 표시 (Week/Month에서는 생략)
- 오늘 마커: 빨간 세로선 (`bg-red-500/70`, 2px 너비), 상단에 "오늘" 라벨
  - `dateToX(today)` 위치에 절대 배치

**Step 2: Commit**

```bash
git add src/components/projects/timeline-grid.tsx
git commit -m "feat: add timeline-grid with weekend shading and today marker"
```

---

## Task 6: timeline-row.tsx + timeline-bar.tsx 바 렌더링

개별 행의 좌측 라벨과 간트 바.

**Files:**
- Create: `src/components/projects/timeline-row.tsx`
- Create: `src/components/projects/timeline-bar.tsx`

**Step 1: timeline-row.tsx 좌측 라벨 구현**

Props:
```typescript
interface TimelineRowLabelProps {
  item: WorkItemWithRelations
  level: number
  isExpanded: boolean
  hasChildren: boolean
  isSelected: boolean
  onToggleExpand: (id: string) => void
  onClick: (id: string) => void
  showTrackerId?: boolean
  rowHeight: number
}
```

렌더링:
- `paddingLeft: level * 16 + 8` (기존 트리와 동일 들여쓰기)
- ChevronRight/ChevronDown 토글 (hasChildren일 때만)
- TrackerIcon (list-view.tsx:52-65 패턴 재사용)
- 항목 번호 (showTrackerId) + 제목 (truncate)
- 선택 상태: `bg-primary/10` 배경
- `React.memo` 필수

**참고:** `src/components/projects/list-view.tsx:52-65` (TrackerIcon), `src/components/projects/tree-item-node.tsx:349` (들여쓰기)

**Step 2: timeline-bar.tsx 간트 바 구현**

Props:
```typescript
interface TimelineBarProps {
  item: WorkItemWithRelations
  dateToX: (date: Date) => number
  pxPerDay: number
  rowIndex: number
  rowHeight: number
  isSelected: boolean
  onClick: (id: string) => void
  onDragEnd: (id: string, newStart: string | null, newEnd: string | null) => void
}
```

렌더링 로직:
- **Zone A** (start_date + due_date 모두): 정상 바
  - `left = dateToX(parseISO(start_date))`
  - `width = dateToX(parseISO(due_date)) - left + pxPerDay` (due_date 포함이므로 +1일)
  - `top = rowIndex * rowHeight + (rowHeight - barHeight) / 2`
  - 배경: `status.color` (opacity 75%)
  - 바 내부 텍스트: 제목 (truncate, 바 너비 > 60px일 때만)
  - 좌측 3px: 우선순위 색상 세로선

- **Zone B-1** (start_date만): 시작점 + 오른쪽 열린 화살표
  - `left = dateToX(parseISO(start_date))`
  - `width = 3일분` (고정) + 오른쪽 끝에 화살표 SVG
  - 점선 테두리

- **Zone B-2** (due_date만): 마름모 마커
  - `left = dateToX(parseISO(due_date))`
  - 다이아몬드 형태 (CSS `transform: rotate(45deg)` 또는 SVG)

- **Folder 서머리 바**: tracker.name === 'Folder'일 때
  - 자식 항목의 범위를 부모로 표시 (이 계산은 timeline-view에서 수행)
  - 얇은 2px 높이 선 + 양끝 꺾쇠
  - `bg-amber-500/60`

- **마감 초과**: `due_date < today && !status.is_closed` -> `border-2 border-red-500`

드래그 핸들 (hover시만 표시):
- 좌측 4px 영역: `cursor: col-resize` -> start_date 리사이즈
- 우측 4px 영역: `cursor: col-resize` -> due_date 리사이즈
- 중앙 영역: `cursor: grab` -> 이동

`React.memo` 필수

**Step 3: Commit**

```bash
git add src/components/projects/timeline-row.tsx src/components/projects/timeline-bar.tsx
git commit -m "feat: add timeline-row labels and timeline-bar gantt bars with zone rendering"
```

---

## Task 7: 바 드래그/리사이즈 (pointer events)

네이티브 pointer events로 바 이동/리사이즈 구현.

**Files:**
- Modify: `src/components/projects/timeline-bar.tsx`

**Step 1: 드래그 로직 추가**

패턴 참고: `src/components/projects/graph-view.tsx:282-294`

드래그 상태 (useRef):
```typescript
const dragRef = useRef<{
  active: boolean
  type: 'move' | 'resize-start' | 'resize-end'
  startX: number
  originalStartDate: string
  originalDueDate: string
} | null>(null)
```

onPointerDown:
- 클릭 위치로 타입 결정 (좌측 4px = resize-start, 우측 4px = resize-end, 나머지 = move)
- `setPointerCapture(e.pointerId)` (graph-view:285)
- 초기 날짜 저장

onPointerMove:
- `deltaX = e.clientX - dragRef.current.startX`
- `deltaDays = Math.round(deltaX / pxPerDay)`
- 타입별 처리:
  - move: start/due 모두 deltaDays만큼 이동
  - resize-start: start만 이동 (due 고정), 최소 1일 보장
  - resize-end: due만 이동 (start 고정), 최소 1일 보장
- **성능**: `useRef`로 임시 위치 저장, `element.style.transform`으로 DOM 직접 조작 (React state 업데이트 하지 않음)
- 드래그 중 날짜 툴팁 표시 (절대 위치 div)

onPointerUp:
- `xToDate`로 최종 날짜 계산
- `onDragEnd(id, newStartDate, newDueDate)` 콜백 호출
- timeline-view에서 `updateWorkItem` Server Action 호출

**Step 2: timeline-view에서 드래그 핸들러 연결**

Modify: `src/components/projects/timeline-view.tsx`

```typescript
const handleBarDragEnd = useCallback(async (
  itemId: string,
  newStart: string | null,
  newEnd: string | null
) => {
  const result = await updateWorkItem(itemId, {
    start_date: newStart,
    due_date: newEnd,
  }, projectId)
  if (result.error) {
    toast.error(result.error) // 실패 시 원복은 realtime이 처리
  }
}, [projectId])
```

**참고:** `src/app/(dashboard)/projects/[key]/actions.ts:239-314` -- updateWorkItem Server Action

**Step 3: Commit**

```bash
git add src/components/projects/timeline-bar.tsx src/components/projects/timeline-view.tsx
git commit -m "feat: add bar drag-to-move and resize-to-adjust-dates with pointer events"
```

---

## Task 8: timeline-unscheduled.tsx 미배정 섹션

날짜가 없는 항목들의 하단 섹션.

**Files:**
- Create: `src/components/projects/timeline-unscheduled.tsx`

**Step 1: 구현**

Props:
```typescript
interface TimelineUnscheduledProps {
  items: WorkItemWithRelations[]
  showTrackerId?: boolean
  onSelectItem: (id: string) => void
  selectedItemId: string | null
}
```

렌더링:
- 접기/펼치기 가능한 헤더: "일정 미배정 (N개)" + ChevronDown
- 각 항목: TrackerIcon + 번호 + 제목 + 담당자 아바타 + "날짜 설정" 버튼
- "날짜 설정" 클릭 시 해당 항목 선택 -> 속성 오버레이에서 날짜 입력
- 스타일: `border-t bg-muted/5`

**Step 2: Commit**

```bash
git add src/components/projects/timeline-unscheduled.tsx
git commit -m "feat: add timeline-unscheduled section for items without dates"
```

---

## Task 9: 속성 오버레이 패널

바 클릭 시 우측에서 슬라이드되는 속성 패널.

**Files:**
- Create: `src/components/projects/timeline-property-overlay.tsx`
- Modify: `src/components/projects/timeline-view.tsx`

**Step 1: 오버레이 구현**

기존 `ALMPropertyPanel` (`src/components/projects/alm-property-panel.tsx`)을 재사용.

```typescript
interface TimelinePropertyOverlayProps {
  workItem: WorkItemWithRelations | null
  allWorkItems: WorkItemWithRelations[]
  statuses: StatusRef[]
  trackers: TrackerRef[]
  members: PersonRef[]
  projectId: string
  currentUserId?: string
  onClose: () => void
}
```

렌더링:
- `position: fixed` 또는 `absolute`
- `right: 0`, `top: 0`, `bottom: 0`, `width: 360px`
- 슬라이드 애니메이션: `transition-transform duration-200`
- 닫기 버튼 (X)
- 내부: `<ALMPropertyPanel .../>` 재사용
- 배경 오버레이: 클릭 시 닫기 (`bg-black/20`)

**Step 2: timeline-view에 연결**

- 선택 시 오버레이 표시, ESC로 닫기
- `onClose` -> `setSelection({ type: 'none', id: null, ids: new Set(), lastSelectedId: null })`

**Step 3: Commit**

```bash
git add src/components/projects/timeline-property-overlay.tsx src/components/projects/timeline-view.tsx
git commit -m "feat: add slide-over property panel for timeline view"
```

---

## Task 10: 가상화 적용

100+ 항목 대응을 위한 수직 가상화.

**Files:**
- Modify: `src/components/projects/timeline-view.tsx`

**Step 1: @tanstack/react-virtual 적용**

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

// 스크롤 컨테이너 ref
const parentRef = useRef<HTMLDivElement>(null)

const rowVirtualizer = useVirtualizer({
  count: flatItems.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => ROW_HEIGHT, // 36px
  overscan: 10,
})
```

좌측 라벨 + 우측 바 모두 가상화된 행만 렌더링.
가상화된 행의 `transform: translateY(start)px`로 위치 지정.

**주의**: sticky 헤더/좌측 리스트와 가상화의 조합이 까다로움.
- 방법: 전체 높이를 `rowVirtualizer.getTotalSize()`로 설정하고, 가상 행만 내부에 absolute position으로 배치

**Step 2: Commit**

```bash
git add src/components/projects/timeline-view.tsx
git commit -m "feat: add vertical virtualization with @tanstack/react-virtual for 100+ items"
```

---

## Task 11: 빈 상태 처리 + 폴리싱

**Files:**
- Modify: `src/components/projects/timeline-view.tsx`
- Modify: `src/components/projects/timeline-bar.tsx`

**Step 1: 빈 상태 구현**

케이스별:
- 항목 0개: "작업 항목을 추가하면 타임라인이 표시됩니다"
- 모든 날짜 미설정: "일정이 설정된 항목이 없습니다. 각 항목의 시작일/마감일을 설정하면 타임라인이 표시됩니다."
- 필터 결과 0개: "현재 필터 조건에 맞는 항목이 없습니다."

스타일: 중앙 정렬 텍스트 + muted-foreground (기존 list-view 빈 상태 패턴)

**Step 2: 시각적 폴리싱**

- 선택된 바 하이라이트 (`ring-2 ring-primary`)
- hover 시 바 밝기 증가 (`brightness-110`)
- Folder 서머리 바 완성 (자식 범위 자동 계산)
- start_date > due_date 경고 처리

**Step 3: 접근성**

- 타임라인 컨테이너: `role="grid"` + `aria-label="프로젝트 타임라인"`
- 각 바: `aria-label`에 항목 정보 포함
- 키보드: ArrowUp/Down 행 이동, Enter 선택

**Step 4: Commit**

```bash
git add src/components/projects/timeline-view.tsx src/components/projects/timeline-bar.tsx
git commit -m "feat: add empty states, visual polish, and accessibility for timeline view"
```

---

## Task 12: 통합 테스트 + 최종 빌드 검증

**Step 1: 빌드 확인**

```bash
pnpm build
```

Expected: 에러 없이 빌드 성공

**Step 2: 수동 검증 체크리스트**

- [ ] 뷰 전환 버튼에 Timeline 표시
- [ ] URL ?view=timeline 동작
- [ ] 날짜 있는 항목에 간트 바 표시
- [ ] 날짜 없는 항목이 미배정 섹션에 표시
- [ ] 일/주/월 줌 전환 동작
- [ ] 오늘 마커 표시
- [ ] 바 클릭 시 속성 오버레이 표시
- [ ] 바 드래그로 날짜 변경
- [ ] 바 리사이즈로 기간 변경
- [ ] 계층 접기/펼치기 동작
- [ ] 기존 필터 (상태, 레벨, 담당자) 타임라인에 적용
- [ ] 다크모드에서 정상 표시
- [ ] 빈 프로젝트에서 빈 상태 메시지 표시

**Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete timeline (gantt chart) view with drag, zoom, and hierarchy support"
```

---

## 파일 요약

**신규 생성 (8개):**
- `src/hooks/use-timeline-state.ts`
- `src/components/projects/timeline-view.tsx`
- `src/components/projects/timeline-header.tsx`
- `src/components/projects/timeline-grid.tsx`
- `src/components/projects/timeline-row.tsx`
- `src/components/projects/timeline-bar.tsx`
- `src/components/projects/timeline-unscheduled.tsx`
- `src/components/projects/timeline-property-overlay.tsx`

**수정 (1개):**
- `src/components/projects/alm-layout.tsx` (ViewMode, 버튼, 렌더링 분기)

**의존성 추가 (2개):**
- `date-fns`
- `@tanstack/react-virtual`
