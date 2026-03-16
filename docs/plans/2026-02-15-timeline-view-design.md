# 타임라인(간트차트) 뷰 설계 문서

**작성일**: 2026-02-15
**범위**: Phase T1 (읽기 전용) + Phase T2 (인터랙티브) 통합 구현

---

## 1. 개요

RalphGrip에 5번째 뷰로 타임라인(간트차트)을 추가한다. work_items의 `start_date`/`due_date`를 시간축 위에 수평 바로 표시하여 프로젝트의 시간적 구조를 시각화한다.

**핵심 가치**: 기존 4개 뷰(ALM, Kanban, List, Graph)에서 빠져 있는 "시간 차원"을 보완

**차별화 포인트**:
- `parent_id` 기반 무제한 계층 구조를 간트에 자연스럽게 반영
- 5개 뷰 간 원클릭 전환 (동일한 `filteredWorkItems` 데이터셋)
- Graph(의존성) <-> Timeline(일정) 전환은 경쟁 제품에 없는 고유 경험

---

## 2. 레이아웃 구조

```
+----------------------------------------------------------+
| [문서] [List] [Kanban] [Graph] [Timeline]  필터칩          |  <- 기존 툴바
+----------+-----------------------------------------------+
| 코너     | 2단 시간축 헤더 (월+일/주)              [줌]    |  <- sticky top
+----------+-----------------------------------------------+
| 항목1    | ========                          (바)  | |  <- sticky left
|  +항목2  |     ==========                         | |
|  +항목3  |       ====                              | |
| 항목4    |   ==============                        | |
| ...      |                            v today      | |
+----------+-----------------------------------------------+
| 미배정 (3개)                                               |  <- 하단 섹션
| - 항목A (날짜 미설정)  [날짜 설정]                            |
+----------------------------------------------------------+
               | 슬라이드 오버레이 속성 패널 ->       |
               +-------------------------------------+
```

- **단일 스크롤 컨테이너** + CSS `position: sticky` (스크롤 동기화 문제 원천 차단)
- **좌측 항목 리스트**: 250px 고정, `sticky left: 0`
- **시간축 헤더**: `sticky top: 0`, 2단 (상단: 월, 하단: 일/주)
- **속성 패널**: 바 클릭 시 우측에서 슬라이드 오버레이 (간트 영역 최대화)
- **미배정 섹션**: 하단에 날짜 미설정 항목 표시 + CTA

---

## 3. 시각적 요소

### 간트 바

- 높이: 20-24px, `rounded-md` (shadcn 기본 radius)
- 배경: `status.color` (opacity 75%), 다크모드에서 opacity 60%
- 바 내부: truncated 제목 텍스트 (바가 충분히 길 때)
- 좌측 3px: 우선순위 색상 세로선
- 마감 초과: `border-red-500` 테두리 + 경고 아이콘
- 완료 항목: 낮은 채도 처리

### 특수 표현

- **Folder(서머리 바)**: 자식들의 min(start_date)~max(due_date) 범위를 얇은 2px 선 + 양끝 꺾쇠로 표시, `bg-amber-500/60`
- **마일스톤**: due_date만 있는 항목 -> 마름모 마커
- **부분 설정**: start_date만 -> 오른쪽 열린 화살표(-->), due_date만 -> 마름모
- **데이터 오류**: start_date > due_date -> 빨간 점선 테두리 + 경고 아이콘

### 시간축

- **2단 헤더**: 상단 월/년, 하단 일/주 (줌 레벨에 따라)
- **오늘 마커**: 빨간 수직선 (`bg-red-500`, opacity 70%), "오늘" 라벨
- **주말**: `bg-muted/20` (연한 배경)
- **셀 너비**: Day 40px, Week 120px (7일), Month 160px (30일)

### 색상 전략

- 모든 컬러를 Tailwind 시맨틱 토큰(`border`, `muted`, `foreground`)으로 표현
- 상태 색상만 인라인 스타일 -> 다크/라이트 자동 전환
- 색약 대응: 상태명 텍스트 + 패턴 이중 인코딩

---

## 4. 인터랙션

### 줌

- 3단계: 일(Day) / 주(Week) / 월(Month)
- 툴바 버튼 (graph-view 줌 UI 재사용)
- 키보드: `+` / `-`
- 줌 전환 시 현재 뷰포트 중심 날짜(anchor point) 유지

### 바 드래그 (pointer events)

- **이동**: 바 중앙 드래그 -> start_date + due_date 동시 이동 (기간 유지)
- **리사이즈**: 바 좌측 끝 -> start_date 변경, 우측 끝 -> due_date 변경
- **스냅**: 1일 단위
- **시각적 피드백**: 드래그 중 날짜 툴팁 표시
- **저장**: Optimistic UI -> `updateWorkItem` Server Action
- **드래그 중 성능**: `useRef` + `requestAnimationFrame`으로 DOM 직접 조작, 드래그 종료 시에만 React state 업데이트

### 계층 구조

- 들여쓰기: `level * 16 + 8` px (기존 트리와 동일)
- 접기/펼치기: ChevronRight/ChevronDown 토글
- Folder 접기 시 서머리 바만 잔류

### 선택 및 속성 패널

- 바 클릭 -> `setSelection()` -> 슬라이드 오버레이 속성 패널
- 바 더블클릭 -> 상세 다이얼로그 (칸반의 onOpenDetail 패턴)

### 네비게이션

- "오늘로 이동" 버튼: 첫 로드 시 자동 스크롤, 이동 후 복귀용
- "전체 맞춤(Fit All)" 버튼: 전체 항목이 보이는 최적 범위로
- 마우스 휠: 간트 그리드에서 수평 스크롤 매핑

---

## 5. 날짜 미설정 처리 (3-Zone 모델)

- **Zone A (완전)**: start_date + due_date 모두 있음 -> 정상 바 렌더링
- **Zone B (부분)**: 하나만 있음 -> 점선 테두리로 "불완전 데이터" 시각 표시
- **Zone C (미배정)**: 둘 다 없음 -> 하단 미배정 섹션에 분리 표시 + 개수 배지 + 날짜 설정 CTA

---

## 6. 데이터 흐름

```
filteredWorkItems (이미 상태/레벨/담당자 필터 적용)
  -> 날짜 있는 항목 -> 간트 바 렌더링 (Zone A + B)
  -> 날짜 없는 항목 -> 하단 "미배정" 섹션 (Zone C)

기존 훅 100% 재사용:
  - useALMSelection (선택 상태)
  - useWorkItemFilters (필터 + levelMap)
  - useRealtimeWorkItems (실시간 동기화)
```

---

## 7. 컴포넌트 아키텍처

- `timeline-view.tsx` -- 진입점, 전체 레이아웃, 줌/스크롤 상태 관리
- `timeline-header.tsx` -- 2단 시간축 헤더
- `timeline-row.tsx` -- 개별 행 (React.memo 필수)
- `timeline-bar.tsx` -- 간트 바 + 드래그 핸들 (pointer events)
- `timeline-grid.tsx` -- 배경 그리드 (CSS gradient 또는 SVG pattern)
- `timeline-unscheduled.tsx` -- 하단 미배정 섹션
- `timeline-property-overlay.tsx` -- 슬라이드 속성 패널
- `use-timeline-state.ts` -- 줌/뷰포트/날짜<->픽셀 변환 훅

---

## 8. 기술 스택

- **날짜 처리**: `date-fns` 신규 설치 (트리쉐이킹, ~5KB gzip)
- **가상화**: `@tanstack/react-virtual` 신규 설치 (~3KB gzip)
- **드래그**: 네이티브 pointer events (graph-view 패턴 재사용)
- **스크롤**: 단일 컨테이너 + CSS sticky
- **외부 간트 라이브러리**: 사용하지 않음 (자체 구현)

---

## 9. alm-layout.tsx 통합

- `ViewMode` 타입에 `'timeline'` 추가
- `VALID_VIEW_MODES` 배열에 추가
- `dynamic(() => import('./timeline-view'), { ssr: false })` 추가
- 뷰 전환 버튼에 타임라인 버튼 추가 (아이콘: `GanttChart` 또는 `CalendarRange`)
- 뷰 렌더링 분기에 timeline 케이스 추가

---

## 10. 접근성

- 컨테이너: `role="grid"` + `aria-label="프로젝트 타임라인"`
- 바: `aria-label="WRV-42: 로그인 구현, 시작: 2/10, 마감: 2/17, 상태: In Progress"`
- 키보드: ArrowUp/Down 행 이동, ArrowLeft/Right 날짜 이동, Enter 선택, +/- 줌
- 색약: 상태명 텍스트 + 우선순위 패턴 이중 인코딩
- 대비: 바 배경과 텍스트 간 4.5:1 이상 (WCAG AA)

---

## 11. 성능 최적화

- **가상화**: @tanstack/react-virtual로 뷰포트 내 행만 렌더링
- **React.memo**: TimelineRow 필수 적용
- **useMemo**: 날짜 범위 계산, 항목 정렬/평탄화
- **드래그 중**: useRef + rAF로 DOM 직접 조작 (React state 업데이트 회피)
- **배경 그리드**: CSS repeating-linear-gradient (DOM 노드 0개)

---

## 12. 반응형

- 1200px 이상: 풀 기능
- 768~1199px: 좌측 리스트 숨김 토글, 바 위에 항목명
- 768px 미만: "타임라인 리스트" 폴백 (수직 타임라인 카드)

---

## 13. 에러/빈 상태

- 항목 0개: CTA "작업 항목을 추가하면 타임라인이 표시됩니다"
- 모든 날짜 미설정: "일정이 설정된 항목이 없습니다" + 안내
- start_date > due_date: 빨간 점선 + 경고 아이콘
- 필터 결과 0개: "필터 조건에 맞는 항목 없음" + 초기화 링크

---

## 14. 향후 확장 (Phase T3)

- 의존성 화살표 (Graph 데이터 연동)
- 담당자별 swimlane
- 베이스라인 비교 (초기 계획 vs 현재)
- 크리티컬 패스 하이라이팅
- 미니맵
- 인쇄/PDF 내보내기
