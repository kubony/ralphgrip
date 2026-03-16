# RalphGrip Design Tokens

이 문서는 RalphGrip 디자인 시스템의 **single source of truth**이다. 모든 시맨틱 토큰은 `src/app/globals.css`에 CSS 변수로 정의되며, `/design-system` 페이지에서 라이브 프리뷰를 확인할 수 있다.

---

## Color Tokens

모든 색상은 `oklch()` 색공간으로 정의된다. Light/Dark 모드 각각 별도 값을 갖는다.

### Core (배경/전경)

- **`--background`** `bg-background`
  - Light: `oklch(1 0 0)` (흰색)
  - Dark: `oklch(0.145 0 0)` (거의 검정)
  - 용도: 페이지 배경, 기본 표면

- **`--foreground`** `text-foreground`
  - Light: `oklch(0.145 0 0)`
  - Dark: `oklch(0.985 0 0)`
  - 용도: 기본 텍스트 색상

### Primary

- **`--primary`** `bg-primary` `text-primary`
  - Light: `oklch(0.205 0 0)` (거의 검정)
  - Dark: `oklch(0.922 0 0)` (밝은 회색)
  - 용도: CTA 버튼, 강조 요소

- **`--primary-foreground`** `text-primary-foreground`
  - Light: `oklch(0.985 0 0)`
  - Dark: `oklch(0.205 0 0)`
  - 용도: Primary 배경 위의 텍스트

### Secondary

- **`--secondary`** `bg-secondary`
  - Light: `oklch(0.97 0 0)` (아주 밝은 회색)
  - Dark: `oklch(0.269 0 0)` (어두운 회색)
  - 용도: 보조 버튼, 부가 표면

- **`--secondary-foreground`** `text-secondary-foreground`
  - Light: `oklch(0.205 0 0)`
  - Dark: `oklch(0.985 0 0)`

### Muted

- **`--muted`** `bg-muted`
  - Light: `oklch(0.97 0 0)`
  - Dark: `oklch(0.269 0 0)`
  - 용도: 비활성 배경, 구분 영역

- **`--muted-foreground`** `text-muted-foreground`
  - Light: `oklch(0.556 0 0)`
  - Dark: `oklch(0.708 0 0)`
  - 용도: 보조 텍스트, 힌트, 캡션

### Card / Popover

- **`--card`** `bg-card`
  - Light: `oklch(1 0 0)`
  - Dark: `oklch(0.205 0 0)`
  - 용도: 카드 컨테이너 배경

- **`--card-foreground`** `text-card-foreground`
  - Light: `oklch(0.145 0 0)`
  - Dark: `oklch(0.985 0 0)`

- **`--popover`** `bg-popover`
  - Light: `oklch(1 0 0)`
  - Dark: `oklch(0.205 0 0)`

- **`--popover-foreground`** `text-popover-foreground`
  - Light: `oklch(0.145 0 0)`
  - Dark: `oklch(0.985 0 0)`

### Accent

- **`--accent`** `bg-accent`
  - Light: `oklch(0.97 0 0)`
  - Dark: `oklch(0.269 0 0)`
  - 용도: 호버 하이라이트, 선택 배경

- **`--accent-foreground`** `text-accent-foreground`
  - Light: `oklch(0.205 0 0)`
  - Dark: `oklch(0.985 0 0)`

### Destructive

- **`--destructive`** `bg-destructive` `text-destructive`
  - Light: `oklch(0.577 0.245 27.325)` (빨간색)
  - Dark: `oklch(0.704 0.191 22.216)` (밝은 빨간색)
  - 용도: 삭제 버튼, 오류 상태, 경고

### Border / Input / Ring

- **`--border`** `border-border`
  - Light: `oklch(0.922 0 0)`
  - Dark: `oklch(1 0 0 / 10%)`
  - 용도: 컨테이너 테두리, 구분선

- **`--input`** `border-input`
  - Light: `oklch(0.922 0 0)`
  - Dark: `oklch(1 0 0 / 15%)`
  - 용도: 입력 필드 테두리

- **`--ring`** `ring-ring`
  - Light: `oklch(0.708 0 0)`
  - Dark: `oklch(0.556 0 0)`
  - 용도: 포커스 링, outline

---

## Chart Tokens

데이터 시각화용 5색 팔레트. Light/Dark 모드에서 완전히 다른 색상을 사용한다.

- **`--chart-1`** `text-chart-1`
  - Light: `oklch(0.646 0.222 41.116)` (오렌지)
  - Dark: `oklch(0.488 0.243 264.376)` (인디고)

- **`--chart-2`** `text-chart-2`
  - Light: `oklch(0.6 0.118 184.704)` (틸)
  - Dark: `oklch(0.696 0.17 162.48)` (그린)

- **`--chart-3`** `text-chart-3`
  - Light: `oklch(0.398 0.07 227.392)` (다크 블루)
  - Dark: `oklch(0.769 0.188 70.08)` (골드)

- **`--chart-4`** `text-chart-4`
  - Light: `oklch(0.828 0.189 84.429)` (옐로)
  - Dark: `oklch(0.627 0.265 303.9)` (퍼플)

- **`--chart-5`** `text-chart-5`
  - Light: `oklch(0.769 0.188 70.08)` (골드)
  - Dark: `oklch(0.645 0.246 16.439)` (레드)

---

## Sidebar Tokens

사이드바 전용 시맨틱 토큰. 메인 UI와 독립적으로 스타일링된다.

- **`--sidebar`** `bg-sidebar`
  - Light: `oklch(0.985 0 0)`
  - Dark: `oklch(0.205 0 0)`

- **`--sidebar-foreground`** `text-sidebar-foreground`
  - Light: `oklch(0.145 0 0)`
  - Dark: `oklch(0.985 0 0)`

- **`--sidebar-primary`** `bg-sidebar-primary`
  - Light: `oklch(0.205 0 0)`
  - Dark: `oklch(0.488 0.243 264.376)` (인디고)

- **`--sidebar-primary-foreground`** `text-sidebar-primary-foreground`
  - Light: `oklch(0.985 0 0)`
  - Dark: `oklch(0.985 0 0)`

- **`--sidebar-accent`** `bg-sidebar-accent`
  - Light: `oklch(0.97 0 0)`
  - Dark: `oklch(0.269 0 0)`

- **`--sidebar-accent-foreground`** `text-sidebar-accent-foreground`
  - Light: `oklch(0.205 0 0)`
  - Dark: `oklch(0.985 0 0)`

- **`--sidebar-border`** `border-sidebar-border`
  - Light: `oklch(0.922 0 0)`
  - Dark: `oklch(1 0 0 / 10%)`

- **`--sidebar-ring`** `ring-sidebar-ring`
  - Light: `oklch(0.708 0 0)`
  - Dark: `oklch(0.556 0 0)`

---

## Typography

4단계 타입 스케일. Geist Sans (sans-serif) / Geist Mono (monospace) 폰트 사용.

- **Display**
  - 클래스: `text-4xl font-semibold tracking-tight`
  - 용도: 페이지 제목, 히어로 텍스트

- **Title**
  - 클래스: `text-2xl font-semibold`
  - 용도: 섹션 제목, 카드 헤더

- **Body**
  - 클래스: `text-base`
  - 용도: 일반 본문 텍스트

- **Subtle**
  - 클래스: `text-sm text-muted-foreground`
  - 용도: 보조 설명, 힌트, 타임스탬프

---

## Radius

기본값 `--radius: 0.625rem` (10px)을 기준으로 7단계 스케일.

- **`--radius-sm`** `rounded-sm` = `calc(var(--radius) - 4px)` = **6px**
- **`--radius-md`** `rounded-md` = `calc(var(--radius) - 2px)` = **8px**
- **`--radius-lg`** `rounded-lg` = `var(--radius)` = **10px**
- **`--radius-xl`** `rounded-xl` = `calc(var(--radius) + 4px)` = **14px**
- **`--radius-2xl`** `rounded-2xl` = `calc(var(--radius) + 8px)` = **18px**
- **`--radius-3xl`** `rounded-3xl` = `calc(var(--radius) + 12px)` = **22px**
- **`--radius-4xl`** `rounded-4xl` = `calc(var(--radius) + 16px)` = **26px**

일반적 사용:
- `rounded-md` / `rounded-lg`: 버튼, 입력 필드, 작은 카드
- `rounded-xl` / `rounded-2xl`: 카드, 다이얼로그, 큰 컨테이너

---

## Surface Patterns

### Glass Surface

반투명 표면 + 블러 효과. 오버레이, 플로팅 UI에 사용.

```html
<div class="rounded-xl border bg-background/60 backdrop-blur-md">
  <div class="pointer-events-none absolute inset-0 bg-primary/10" />
  <!-- content -->
</div>
```

핵심 요소:
- `bg-background/60`: 배경색 60% 불투명도
- `backdrop-blur-md`: 뒤쪽 콘텐츠 블러
- `bg-primary/10`: 색조 오버레이 (10% 불투명도)

### 테마 전환 컨트롤 Surface

```html
<div class="rounded-xl border bg-background/70 p-2 backdrop-blur-sm">
  <!-- theme buttons -->
</div>
```

---

## Button Variants

shadcn/ui Button 컴포넌트 5가지 variant.

- **default** (Primary)
  - 배경: `bg-primary`, 텍스트: `text-primary-foreground`
  - 용도: 주요 행동 (저장, 확인, 생성)

- **secondary**
  - 배경: `bg-secondary`, 텍스트: `text-secondary-foreground`
  - 용도: 보조 행동 (취소, 뒤로)

- **outline**
  - 테두리: `border-input`, 배경: 투명
  - 용도: 선택적 행동, 필터 토글

- **ghost**
  - 배경: 투명, 호버 시 `bg-accent`
  - 용도: 툴바 버튼, 인라인 액션

- **destructive**
  - 배경: `bg-destructive`
  - 용도: 삭제, 위험한 행동

---

## Tailwind 매핑 요약

CSS 변수와 Tailwind 유틸리티 클래스 대응 관계. `@theme inline` 블록에서 매핑된다.

### 색상

- `--background` → `bg-background`, `text-background`
- `--foreground` → `bg-foreground`, `text-foreground`
- `--primary` → `bg-primary`, `text-primary`
- `--primary-foreground` → `bg-primary-foreground`, `text-primary-foreground`
- `--secondary` → `bg-secondary`, `text-secondary`
- `--secondary-foreground` → `bg-secondary-foreground`, `text-secondary-foreground`
- `--muted` → `bg-muted`, `text-muted`
- `--muted-foreground` → `bg-muted-foreground`, `text-muted-foreground`
- `--accent` → `bg-accent`, `text-accent`
- `--accent-foreground` → `bg-accent-foreground`, `text-accent-foreground`
- `--card` → `bg-card`, `text-card`
- `--card-foreground` → `bg-card-foreground`, `text-card-foreground`
- `--popover` → `bg-popover`, `text-popover`
- `--popover-foreground` → `bg-popover-foreground`, `text-popover-foreground`
- `--destructive` → `bg-destructive`, `text-destructive`
- `--border` → `border-border`
- `--input` → `border-input`
- `--ring` → `ring-ring`
- `--chart-1` ~ `--chart-5` → `text-chart-1` ~ `text-chart-5`
- `--sidebar` → `bg-sidebar`
- `--sidebar-*` → `bg-sidebar-*`, `text-sidebar-*`, `border-sidebar-*`, `ring-sidebar-*`

### 불투명도 변형

Tailwind의 `/` 문법으로 불투명도를 조절할 수 있다:

```
bg-background/60    → 60% 불투명도
bg-primary/10       → 10% 불투명도
border-border/50    → 50% 불투명도
```

### Radius

- `--radius-sm` → `rounded-sm`
- `--radius-md` → `rounded-md`
- `--radius-lg` → `rounded-lg`
- `--radius-xl` → `rounded-xl`
- `--radius-2xl` → `rounded-2xl`
- `--radius-3xl` → `rounded-3xl`
- `--radius-4xl` → `rounded-4xl`

### 폰트

- `--font-sans` (Geist Sans) → `font-sans`
- `--font-mono` (Geist Mono) → `font-mono`

---

## 사용 규칙

### 필수

- 모든 색상은 시맨틱 토큰을 사용한다 (`bg-primary`, `text-muted-foreground` 등)
- 새로운 색상이 필요하면 `globals.css`에 CSS 변수를 추가하고 이 문서를 업데이트한다
- `/design-system` 프리뷰 페이지와 이 문서를 동기화 상태로 유지한다

### 금지

- Hex/RGB/HSL 리터럴 하드코딩 금지 (`#ff0000`, `rgb(255,0,0)` 등)
- Tailwind 팔레트 클래스 직접 사용 금지 (`text-blue-500`, `bg-purple-100` 등)
- 인라인 style에 색상값 직접 지정 금지

### 예외

- **서드파티 브랜드 로고**: 외부 서비스 아이콘 색상 (Google, Slack 등)
- **DB 기반 색상**: 상태 색상 등 데이터에서 오는 값. 단, fallback은 시맨틱 토큰 사용
- **차트 데이터 색상**: chart-1 ~ chart-5 범위를 넘어서는 경우, 일관된 팔레트로 확장

---

## 파일 참조

- **CSS 변수 정의**: `src/app/globals.css`
- **라이브 프리뷰**: `src/components/design/design-system-showcase.tsx`
- **프리뷰 페이지**: `src/app/(dashboard)/design-system/page.tsx`
- **하드코딩 감사 스크립트**: `.claude/skills/design-system-guard/scripts/audit-hardcoded-colors.sh`
