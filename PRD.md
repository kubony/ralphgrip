# RalphGrip - Product Requirements Document

**버전**: 1.0
**작성일**: 2026-02-02
**작성자**: 서인근, 김다혜

---

## 1. 개요

### 1.1. 제품 비전

**RalphGrip**는 Jira의 구조화된 프로젝트 관리와 AI 기능을 결합한 차세대 프로젝트 관리 도구이다.

**해결하는 문제**

- **Notion의 과도한 자유도**: 구조 없이 정보가 흩어지고, 새 멤버 온보딩이 어려움
- **Jira의 AI 부재**: 반복적인 작업 분류, 일정 추정을 수동으로 해야 함
- **고아 태스크 문제**: 어느 폴더에도 속하지 않는 작업이 생겨 추적 불가

**차별화 포인트**

- 코드비머 ALM 스타일의 트래커/폴더 구조로 작업을 체계적으로 관리
- 프로젝트 템플릿으로 필수 정보 입력을 강제하여 정보 누락 방지
- Phase 2에서 AI 어시스턴트 도입으로 작업 추천/요약/분석 지원

### 1.2. 목표 및 성공 지표

**MVP 목표**

- 2인 개발팀이 실제 프로젝트에 사용 가능한 수준의 작업 관리 도구 완성
- 칸반보드와 리스트뷰로 작업 현황 파악 및 상태 변경 가능

**성공 지표**

- 내부 팀(2명)이 일주일간 실사용 후 기존 도구(Notion/Jira) 대비 만족
- 작업 생성부터 완료까지의 전체 플로우 동작
- 실시간 동기화로 두 명이 동시 작업 시 충돌 없음

### 1.3. 범위

**In Scope (MVP)**

- Google OAuth 인증
- 프로젝트 생성 및 멤버 관리
- 자유로운 작업 계층 구조 (parent_id 기반)
- 트래커 및 폴더 기반 작업 구조화
- 칸반보드 뷰 (드래그앤드롭)
- 리스트뷰 (정렬/필터링)
- 작업 속성 (상태, 우선순위, 담당자, 기한)

**Out of Scope (Phase 2 이후)**

- AI 기능 (자동 분류, 요약, 추천)
- 외부 연동 (Slack, Google Calendar, Notion)
- 타임라인/간트차트 뷰
- 공수(Man Hour) 관리
- 관리자 대시보드
- 이슈 관리 기능

### 1.4. 용어 정의

- **Project**: 작업을 관리하는 최상위 단위. 고유한 키(예: WRV)를 가짐
- **Tracker**: 작업 유형 정의 (Bug, Task, Feature 등). 계층과 무관한 순수 유형
- **Folder**: 작업을 논리적으로 그룹화하는 컨테이너. 하위 폴더 지원
- **Work Item**: 모든 작업 단위. parent_id로 자유로운 계층 구조 형성
- **Status**: 작업 진행 상태 (To Do, In Progress, Done 등)
- **Priority**: 작업 우선순위 (Critical, High, Medium, Low)

---

## 2. 사용자 및 페르소나

### 2.1. 타겟 사용자

**1차 타겟 (MVP)**

- 내부 개발팀: 서인근, 김다혜
- 2인 개발팀으로 RalphGrip 자체 개발에 사용

**2차 타겟 (향후)**

- 소규모 개발팀 (2-10명)
- 스타트업 및 사이드 프로젝트 팀
- 구조화된 관리가 필요하지만 Jira가 과한 팀

### 2.2. 사용자 페르소나

**페르소나 1: PM/Tech Lead - 인근**

- **역할**: 프로젝트 전체 조망, 우선순위 결정
- **니즈**: 전체 진행 상황 한눈에 파악, 병목 지점 식별
- **행동**: 대형 작업 생성, 작업 할당, 상태 모니터링
- **Pain Point**: 작업이 흩어져 있어 전체 그림 파악 어려움

**페르소나 2: Developer - 다혜**

- **역할**: 할당된 작업 수행, 기술적 구현
- **니즈**: 내 할 일 명확히 파악, 집중할 작업 선택
- **행동**: 할당된 작업 확인, 상태 업데이트, 하위 작업 생성
- **Pain Point**: 여러 도구를 오가며 작업 확인

### 2.3. 사용자 여정 맵

**온보딩 여정**

1. Google 계정으로 로그인
2. 프로젝트 목록 확인 (비어있음)
3. 새 프로젝트 생성 (이름, 키 입력)
4. 기본 트래커와 상태 자동 생성됨
5. 첫 번째 작업 생성

**일상 사용 여정**

1. 로그인 → 프로젝트 선택
2. 칸반보드에서 전체 현황 확인
3. 내 담당 작업 필터링
4. 작업 상태 드래그로 변경
5. 하위 작업 생성
6. 리스트뷰로 전환하여 우선순위 정렬

---

## 3. 기능 명세

### 3.1. 인증

**FR-AUTH-001: Google OAuth 로그인**

- Google 계정으로 로그인 가능
- Supabase Auth를 통한 OAuth 플로우
- 최초 로그인 시 프로필 자동 생성

**FR-AUTH-002: 로그아웃**

- 현재 세션 종료
- 로그인 페이지로 리다이렉트

**FR-AUTH-003: 세션 관리**

- 로그인 상태 유지 (Supabase 세션)
- 미인증 사용자는 로그인 페이지로 리다이렉트

**FR-AUTH-004: 프로필 표시**

- 헤더에 사용자 아바타 및 이름 표시
- 프로필 드롭다운 메뉴 (로그아웃 포함)

### 3.2. 프로젝트 관리

**FR-PROJ-001: 프로젝트 생성**

- 이름 (필수), 설명 (선택), 키 (필수, 영문 대문자 3-5자)
- 키는 작업 번호 prefix로 사용 (예: WRV-123)
- 생성자가 자동으로 Owner가 됨

**FR-PROJ-002: 프로젝트 목록 조회**

- 내가 멤버인 프로젝트만 표시
- 프로젝트 이름, 키, 최근 활동 표시

**FR-PROJ-003: 프로젝트 수정**

- 이름, 설명 수정 가능
- 키는 변경 불가 (작업 번호 일관성)

**FR-PROJ-004: 프로젝트 삭제**

- Owner만 삭제 가능
- 확인 다이얼로그 필수
- 하위 모든 데이터 삭제 (soft delete 고려)

**FR-PROJ-005: 멤버 초대**

- 이메일로 멤버 초대
- 역할 지정: Admin, Member
- 초대받은 사용자가 가입 시 자동 연결

**FR-PROJ-006: 멤버 관리**

- 멤버 목록 조회
- 역할 변경 (Owner, Admin만)
- 멤버 제거 (Owner, Admin만)

### 3.3. 작업 관리

**FR-WORK-001: 작업 생성**

- 제목 (필수), 설명 (선택)
- 트래커 선택 (Bug, Task, Feature 등)
- 상위 작업 선택 (선택적) - 자유로운 계층 구조
- 폴더 선택 (선택적)
- 생성 시 프로젝트 내 순번 자동 할당

**FR-WORK-002: 작업 조회**

- 상세 정보 패널 또는 모달
- 제목, 설명, 상태, 우선순위, 담당자, 기한
- 하위 작업 목록 표시
- 활동 로그 (생성, 수정 이력)

**FR-WORK-003: 작업 수정**

- 모든 필드 수정 가능
- 실시간 저장 (debounce)

**FR-WORK-004: 작업 삭제**

- 확인 다이얼로그
- 하위 작업 처리 옵션 (함께 삭제 또는 상위로 이동)

**FR-WORK-005: 계층 구조**

- parent_id 기반 자유로운 계층 구조
- 어떤 트래커든 하위 작업 가질 수 있음
- 상위 작업 변경 가능
- 계층 깊이 제한 없음

**FR-WORK-006: 작업 번호**

- 프로젝트 키 + 순번 (예: WRV-1, WRV-2)
- 프로젝트 내에서 유일
- 삭제되어도 번호 재사용 안 함

### 3.4. 트래커 및 폴더 구조

**FR-TRACK-001: 트래커 관리**

- 기본 트래커: Feature, Bug, Task, Improvement, Documentation
- 트래커 추가/수정/삭제 가능
- 트래커별 색상, 아이콘 지정
- 트래커는 순수 작업 유형만 표현 (계층과 무관)

**FR-TRACK-002: 트래커 필터링**

- 특정 트래커의 작업만 필터링
- 칸반/리스트뷰에서 적용

**FR-FOLDER-001: 폴더 생성**

- 이름 (필수)
- 상위 폴더 선택 (선택적)
- 프로젝트 루트 또는 다른 폴더 하위에 생성

**FR-FOLDER-002: 폴더 트리 표시**

- 사이드바에 폴더 트리 구조 표시
- 확장/축소 가능
- 폴더 클릭 시 해당 폴더의 작업만 필터링

**FR-FOLDER-003: 폴더 이동**

- 드래그앤드롭으로 폴더 위치 변경
- 폴더 간 작업 이동

**FR-FOLDER-004: 폴더 삭제**

- 하위 폴더/작업 처리 옵션 필요
- 작업은 상위 폴더로 이동 또는 폴더 연결 해제

### 3.5. 뷰 (칸반보드/리스트뷰)

**FR-VIEW-001: 칸반보드**

- 상태별 컬럼 표시
- 작업 카드 드래그앤드롭으로 상태 변경
- 컬럼 내 카드 순서 변경 가능
- 카드에 표시: 번호, 제목, 담당자 아바타, 우선순위 뱃지

**FR-VIEW-002: 리스트뷰**

- 테이블 형태로 작업 표시
- 컬럼: 번호, 제목, 상태, 우선순위, 담당자, 기한
- 컬럼별 정렬 가능
- 행 클릭 시 상세 패널 열기

**FR-VIEW-003: 뷰 전환**

- 헤더에서 칸반/리스트 뷰 전환 버튼
- 뷰 전환 시 필터 상태 유지

**FR-VIEW-004: 필터링**

- 담당자 필터
- 우선순위 필터
- 트래커 필터
- 폴더 필터 (사이드바)
- 복합 필터 가능

**FR-VIEW-005: 검색**

- 제목 기반 검색
- 실시간 검색 결과 표시

### 3.6. 작업 속성 관리

**FR-ATTR-001: 상태 관리**

- 기본 상태: To Do, In Progress, Done
- 커스텀 상태 추가 가능
- 상태 카테고리: todo, in_progress, done (칸반 그룹핑용)
- 상태별 색상 지정

**FR-ATTR-002: 우선순위**

- 고정 값: Critical, High, Medium, Low
- 우선순위별 색상/뱃지

**FR-ATTR-003: 담당자**

- 프로젝트 멤버 중 선택
- 단일 담당자 (MVP)
- 미할당 가능

**FR-ATTR-004: 생성자**

- 작업 생성 시 자동 설정 (현재 사용자)
- 수정 불가 (읽기 전용)
- "내가 생성한 작업" 필터링에 활용

**FR-ATTR-005: 기한**

- 날짜 선택
- 기한 지난 작업 시각적 표시 (빨간색)

---

## 4. 사용자 스토리

### 4.1. 인증 관련

**US-AUTH-001**: 사용자로서, Google 계정으로 로그인하고 싶다. 그래서 별도 회원가입 없이 빠르게 시작할 수 있다.

**US-AUTH-002**: 사용자로서, 로그아웃하고 싶다. 그래서 다른 계정으로 전환하거나 보안을 유지할 수 있다.

### 4.2. 프로젝트 관련

**US-PROJ-001**: 사용자로서, 새 프로젝트를 생성하고 싶다. 그래서 새로운 작업을 체계적으로 관리할 수 있다.

**US-PROJ-002**: 사용자로서, 프로젝트에 팀원을 초대하고 싶다. 그래서 함께 작업을 관리할 수 있다.

**US-PROJ-003**: 사용자로서, 내가 속한 프로젝트 목록을 보고 싶다. 그래서 작업할 프로젝트를 선택할 수 있다.

### 4.3. 작업 관리 관련

**US-WORK-001**: PM으로서, 대형 작업을 생성하고 하위 작업을 연결하고 싶다. 그래서 기능을 구조적으로 관리할 수 있다.

**US-WORK-002**: 개발자로서, 내게 할당된 작업만 필터링하고 싶다. 그래서 집중해야 할 작업을 빠르게 파악할 수 있다.

**US-WORK-003**: 개발자로서, 작업 상태를 변경하고 싶다. 그래서 진행 상황을 팀과 공유할 수 있다.

**US-WORK-004**: 사용자로서, 작업을 폴더로 그룹화하고 싶다. 그래서 관련 작업을 논리적으로 묶어 관리할 수 있다.

**US-WORK-005**: 사용자로서, 작업에 우선순위를 지정하고 싶다. 그래서 중요한 작업을 먼저 처리할 수 있다.

**US-WORK-006**: 사용자로서, 작업에 기한을 설정하고 싶다. 그래서 일정을 관리할 수 있다.

### 4.4. 뷰 관련

**US-VIEW-001**: 사용자로서, 칸반보드에서 작업을 드래그하고 싶다. 그래서 직관적으로 상태를 변경할 수 있다.

**US-VIEW-002**: 사용자로서, 리스트뷰에서 우선순위로 정렬하고 싶다. 그래서 중요한 작업을 먼저 볼 수 있다.

**US-VIEW-003**: 사용자로서, 뷰를 전환하고 싶다. 그래서 상황에 맞는 방식으로 작업을 볼 수 있다.

**US-VIEW-004**: 사용자로서, 특정 폴더의 작업만 보고 싶다. 그래서 관련 작업에 집중할 수 있다.

---

## 5. UI/UX 흐름

### 5.1. 정보 구조 (IA)

```
/                           → 랜딩 페이지 (미인증) / 대시보드 (인증)
/login                      → 로그인 페이지
/projects                   → 프로젝트 목록
/projects/new               → 프로젝트 생성
/projects/[id]              → 프로젝트 홈 (기본: 칸반보드)
/projects/[id]/board        → 칸반보드 뷰
/projects/[id]/list         → 리스트뷰
/projects/[id]/settings     → 프로젝트 설정
/projects/[id]/settings/members    → 멤버 관리
/projects/[id]/settings/trackers   → 트래커 관리
/projects/[id]/settings/statuses   → 상태 관리
```

### 5.2. 주요 화면 흐름

**로그인 흐름**

```
[랜딩 페이지] → [Google OAuth] → [프로젝트 목록]
                                      ↓
                              (프로젝트 없음)
                                      ↓
                              [프로젝트 생성]
```

**일상 사용 흐름**

```
[프로젝트 목록] → [프로젝트 선택] → [칸반보드]
                                      ↓
                              [작업 카드 클릭]
                                      ↓
                              [작업 상세 패널]
                                      ↓
                              [수정/상태변경]
```

### 5.3. 레이아웃 구조

**메인 레이아웃**

```
+--------------------------------------------------+
|  Header (로고, 뷰전환, 검색, 프로필)              |
+----------+---------------------------------------+
|          |                                       |
| Sidebar  |           Main Content                |
| (폴더    |         (칸반보드/리스트)             |
|  트리)   |                                       |
|          |                                       |
+----------+---------------------------------------+
```

**칸반보드 레이아웃**

```
+--------------------------------------------------+
|  [To Do]       [In Progress]       [Done]        |
|  +--------+    +--------+          +--------+    |
|  | Card 1 |    | Card 3 |          | Card 5 |    |
|  +--------+    +--------+          +--------+    |
|  | Card 2 |    | Card 4 |                        |
|  +--------+    +--------+                        |
+--------------------------------------------------+
```

**작업 상세 패널**

- 오른쪽 슬라이드 패널
- 제목, 설명, 속성, 하위 작업, 활동 로그

### 5.4. 반응형 브레이크포인트

- **Desktop**: 1280px 이상 (사이드바 + 메인)
- **Tablet**: 768px ~ 1279px (사이드바 축소)
- **Mobile**: 767px 이하 (사이드바 숨김, 햄버거 메뉴)

---

## 6. 데이터 모델

### 6.1. ERD 개요

```
profiles (Supabase Auth 확장)
    │
    ├──< project_members >──┤
    │                       │
    │                   projects
    │                       │
    │                       ├──< trackers
    │                       │
    │                       ├──< statuses
    │                       │
    │                       ├──< folders (self-ref)
    │                       │
    │                       └──< work_items (self-ref)
    │                               │
    └───────────────────────────────┘ (assignee, created_by)
```

### 6.2. 테이블 스키마

**profiles** (Supabase Auth users 확장)

- `id` UUID PK (auth.users.id 참조)
- `email` TEXT NOT NULL
- `display_name` TEXT
- `avatar_url` TEXT
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()

**projects**

- `id` UUID PK DEFAULT gen_random_uuid()
- `name` TEXT NOT NULL
- `key` TEXT UNIQUE NOT NULL (예: WRV, 3-5자 영문 대문자)
- `description` TEXT
- `owner_id` UUID FK → profiles.id NOT NULL
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()

**project_members**

- `id` UUID PK DEFAULT gen_random_uuid()
- `project_id` UUID FK → projects.id NOT NULL
- `user_id` UUID FK → profiles.id NOT NULL
- `role` TEXT NOT NULL (owner, admin, member)
- `created_at` TIMESTAMPTZ DEFAULT now()
- UNIQUE(project_id, user_id)

**trackers**

- `id` UUID PK DEFAULT gen_random_uuid()
- `project_id` UUID FK → projects.id NOT NULL
- `name` TEXT NOT NULL (Feature, Bug, Task, Improvement, Documentation 등)
- `color` TEXT (hex color)
- `icon` TEXT (아이콘 이름)
- `position` INTEGER DEFAULT 0
- `created_at` TIMESTAMPTZ DEFAULT now()
- UNIQUE(project_id, name)

**statuses**

- `id` UUID PK DEFAULT gen_random_uuid()
- `project_id` UUID FK → projects.id NOT NULL
- `name` TEXT NOT NULL
- `category` TEXT NOT NULL (todo, in_progress, done)
- `color` TEXT (hex color)
- `position` INTEGER DEFAULT 0
- `created_at` TIMESTAMPTZ DEFAULT now()
- UNIQUE(project_id, name)

**folders**

- `id` UUID PK DEFAULT gen_random_uuid()
- `project_id` UUID FK → projects.id NOT NULL
- `parent_id` UUID FK → folders.id (nullable, self-reference)
- `name` TEXT NOT NULL
- `position` INTEGER DEFAULT 0
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()

**work_items**

- `id` UUID PK DEFAULT gen_random_uuid()
- `project_id` UUID FK → projects.id NOT NULL
- `tracker_id` UUID FK → trackers.id NOT NULL
- `folder_id` UUID FK → folders.id (nullable)
- `parent_id` UUID FK → work_items.id (nullable, 계층 구조)
- `status_id` UUID FK → statuses.id NOT NULL
- `number` INTEGER NOT NULL (프로젝트 내 순번)
- `title` TEXT NOT NULL
- `description` TEXT
- `priority` TEXT (critical, high, medium, low)
- `assignee_id` UUID FK → profiles.id (nullable)
- `due_date` DATE (nullable)
- `position` INTEGER DEFAULT 0 (칸반 내 순서)
- `created_by` UUID FK → profiles.id NOT NULL
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()
- UNIQUE(project_id, number)

### 6.3. 관계 정의

**1:N 관계**

- projects → project_members (프로젝트당 여러 멤버)
- projects → trackers (프로젝트당 여러 트래커)
- projects → statuses (프로젝트당 여러 상태)
- projects → folders (프로젝트당 여러 폴더)
- projects → work_items (프로젝트당 여러 작업)
- folders → folders (폴더당 여러 하위 폴더)
- work_items → work_items (작업당 여러 하위 작업)

**N:1 관계**

- work_items → profiles (담당자)
- work_items → profiles (생성자)
- project_members → profiles (사용자)

### 6.4. Supabase RLS 정책

**profiles**

```sql
-- 본인 프로필만 수정 가능
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 모든 인증 사용자 조회 가능
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');
```

**projects**

```sql
-- 프로젝트 멤버만 조회 가능
CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- 인증 사용자 생성 가능
CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Owner만 수정/삭제 가능
CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (owner_id = auth.uid());
```

**work_items**

```sql
-- 프로젝트 멤버만 접근 가능
CREATE POLICY "work_items_select" ON work_items
  FOR SELECT USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "work_items_insert" ON work_items
  FOR INSERT WITH CHECK (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "work_items_update" ON work_items
  FOR UPDATE USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "work_items_delete" ON work_items
  FOR DELETE USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );
```

### 6.5. 인덱스

```sql
-- 프로젝트별 작업 조회
CREATE INDEX idx_work_items_project ON work_items(project_id);

-- 상태별 조회 (칸반)
CREATE INDEX idx_work_items_status ON work_items(project_id, status_id);

-- 담당자별 조회
CREATE INDEX idx_work_items_assignee ON work_items(assignee_id) WHERE assignee_id IS NOT NULL;

-- 폴더별 조회
CREATE INDEX idx_work_items_folder ON work_items(folder_id) WHERE folder_id IS NOT NULL;

-- 계층 조회
CREATE INDEX idx_work_items_parent ON work_items(parent_id) WHERE parent_id IS NOT NULL;

-- 폴더 계층
CREATE INDEX idx_folders_parent ON folders(parent_id) WHERE parent_id IS NOT NULL;

-- 프로젝트 멤버
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

---

## 7. API 설계 가이드

### 7.1. API 원칙

**Supabase 클라이언트 직접 사용**

- 별도 REST API 서버 구축하지 않음
- Supabase JS Client로 직접 DB 접근
- RLS로 보안 처리

**Server Actions 활용**

- 데이터 변경은 Next.js Server Actions 사용
- 서버 사이드 유효성 검증
- 에러 핸들링 일관성

**실시간 구독**

- Supabase Realtime으로 실시간 동기화
- 칸반보드 작업 이동 시 즉시 반영

### 7.2. Supabase 클라이언트 사용 패턴

**서버 컴포넌트에서 조회**

```typescript
// app/projects/[id]/page.tsx
import { createServerClient } from '@/lib/supabase/server'

export default async function ProjectPage({ params }) {
  const supabase = createServerClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*, work_items(*)')
    .eq('id', params.id)
    .single()

  return <ProjectView project={project} />
}
```

**Server Actions에서 변경**

```typescript
// app/actions/work-items.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createWorkItem(data: CreateWorkItemInput) {
  const supabase = createServerClient()

  const { data: workItem, error } = await supabase
    .from('work_items')
    .insert(data)
    .select()
    .single()

  if (error) throw error

  revalidatePath(`/projects/${data.project_id}`)
  return workItem
}
```

**클라이언트에서 실시간 구독**

```typescript
// components/kanban-board.tsx
'use client'

import { useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export function KanbanBoard({ projectId }) {
  const supabase = createBrowserClient()

  useEffect(() => {
    const channel = supabase
      .channel(`project:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'work_items',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        // 상태 업데이트
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])
}
```

### 7.3. 주요 작업별 패턴

**프로젝트 생성**

1. Server Action 호출
2. projects 테이블에 INSERT
3. project_members에 owner 추가
4. 기본 trackers 생성 (Feature, Bug, Task, Improvement, Documentation)
5. 기본 statuses 생성 (To Do, In Progress, Done)
6. 프로젝트 목록 revalidate

**작업 상태 변경 (드래그앤드롭)**

1. Optimistic UI 업데이트
2. Server Action 호출
3. work_items 테이블 UPDATE
4. 실패 시 롤백
5. Realtime으로 다른 사용자에게 전파

---

## 8. 기술 아키텍처

### 8.1. 시스템 구성도

```
┌─────────────────────────────────────────────────────────┐
│                        Client                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Next.js App (App Router)            │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │    │
│  │  │ React   │  │ Zustand │  │ Supabase Client │  │    │
│  │  │ Server  │  │ (State) │  │ (Realtime)      │  │    │
│  │  │ Comps   │  │         │  │                 │  │    │
│  │  └─────────┘  └─────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                       Supabase                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │    Auth     │  │  PostgreSQL │  │  Realtime   │      │
│  │  (Google    │  │   (RLS)     │  │  (WebSocket)│      │
│  │   OAuth)    │  │             │  │             │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### 8.2. 프론트엔드 구조

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 인증 관련 라우트 그룹
│   │   ├── login/
│   │   └── callback/
│   ├── (main)/              # 메인 앱 라우트 그룹
│   │   ├── projects/
│   │   │   ├── page.tsx     # 프로젝트 목록
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── page.tsx # 프로젝트 홈
│   │   │       ├── board/
│   │   │       ├── list/
│   │   │       └── settings/
│   │   └── layout.tsx
│   ├── actions/             # Server Actions
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                  # 기본 UI 컴포넌트
│   ├── auth/                # 인증 관련
│   ├── project/             # 프로젝트 관련
│   ├── work-item/           # 작업 관련
│   ├── kanban/              # 칸반보드
│   └── list-view/           # 리스트뷰
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # 브라우저 클라이언트
│   │   ├── server.ts        # 서버 클라이언트
│   │   └── middleware.ts    # 미들웨어용
│   ├── utils.ts
│   └── types.ts             # TypeScript 타입
├── hooks/                   # Custom hooks
├── store/                   # Zustand stores
└── middleware.ts            # Next.js 미들웨어
```

### 8.3. 인증 플로우

```
[사용자] → [/login] → [Google OAuth] → [Supabase Auth]
                                              │
                                              ▼
                                    [/auth/callback]
                                              │
                                              ▼
                                    [세션 생성 & 쿠키 설정]
                                              │
                                              ▼
                                    [/projects로 리다이렉트]
```

**미들웨어 보호**

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createMiddlewareClient()
  const { data: { session } } = await supabase.auth.getSession()

  // 보호된 경로에 미인증 접근 시 로그인으로 리다이렉트
  if (!session && request.nextUrl.pathname.startsWith('/projects')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}
```

### 8.4. 실시간 동기화

**채널 구조**

- `project:{projectId}` - 프로젝트 내 모든 변경사항
- work_items 테이블 변경 감지
- INSERT, UPDATE, DELETE 이벤트

**Optimistic UI**

1. 사용자 액션 발생
2. 즉시 UI 업데이트 (낙관적)
3. 서버에 요청
4. 성공 시 확정, 실패 시 롤백
5. Realtime으로 다른 클라이언트에 전파

---

## 9. 마일스톤 및 페이즈

### 9.1. Phase 1: MVP

**Sprint 1: 기반 구축**

- Next.js 프로젝트 셋업
- Supabase 프로젝트 생성 및 연결
- Google OAuth 설정
- 인증 플로우 구현 (로그인/로그아웃)
- DB 스키마 생성 (모든 테이블)
- RLS 정책 설정
- 기본 레이아웃 (헤더, 사이드바)

**Sprint 2: 핵심 기능**

- 프로젝트 CRUD
- 프로젝트 생성 시 기본 데이터 자동 생성
- 작업(work_item) CRUD
- 트래커 관리
- 폴더 관리 및 트리 구조
- 자유로운 계층 구조 (parent_id 기반)

**Sprint 3: 뷰 및 마무리**

- 칸반보드 구현 (드래그앤드롭)
- 리스트뷰 구현 (정렬/필터)
- 실시간 동기화 (Supabase Realtime)
- 필터링 기능
- 버그 수정 및 QA
- 내부 테스트

**MVP 완료 조건**

- [ ] 두 명이 동시에 사용 가능
- [ ] 작업 생성/수정/삭제/상태변경 가능
- [ ] 칸반/리스트 뷰 전환 가능
- [ ] 폴더 기반 작업 그룹화 가능
- [ ] 실시간 동기화 동작

### 9.2. Phase 2: AI 기능

**예상 기능**

- 작업 자동 분류 (트래커 추천)
- 작업 설명 자동 생성
- 중복 작업 감지
- 일정 추정 제안
- 작업 요약

**기술 고려사항**

- OpenAI API 또는 Claude API 연동
- 프롬프트 엔지니어링
- 컨텍스트 관리 (프로젝트 지식)

### 9.3. Phase 3: 확장 기능

**외부 연동**

- Slack API: 알림, 상태 업데이트
- Google Calendar: 일정 동기화
- GitHub: 이슈/PR 연동

**추가 뷰**

- 타임라인/간트차트 뷰
- Mine 뷰 (내 작업 모아보기)

**관리 기능**

- 공수(Man Hour) 관리
- 관리자 대시보드
- 이슈 관리

**확장성**

- 다중 팀 지원
- 권한 세분화
- 워크플로우 자동화

---

## 10. 부록

### 10.1. 참고 자료

- 코드비머 ALM (https://codebeamer.com/)
  - 트래커/폴더 구조 참고
  - 요구사항 관리 방식 참고
- Jira (https://www.atlassian.com/software/jira)
  - Epic/Story/Task 구조 참고
  - 칸반보드 UX 참고
- Linear (https://linear.app/)
  - 모던한 UI/UX 참고
  - 키보드 단축키 참고
- Supabase 공식 문서 (https://supabase.com/docs)
  - Auth, Database, Realtime 가이드
- Next.js App Router 문서 (https://nextjs.org/docs/app)

### 10.2. 변경 이력

- **v1.1** (2026-02-03)
  - 트래커 모델 단순화: 서인근
  - Epic/Story/Ticket을 트래커에서 제거
  - 계층 구조는 parent_id로만 표현
  - 트래커는 순수 작업 유형만 (Feature, Bug, Task, Improvement, Documentation)

- **v1.0** (2026-02-02)
  - 최초 작성: 서인근
  - MVP 범위 정의
  - 기술 스택 확정: Next.js + Supabase
  - 데이터 모델 설계
  - 마일스톤 정의
