# 상태 변경 시 실적 일정 자동 업데이트 Spec

> 생성일: 2026-03-16
> 인터뷰 기반 자동 생성

## Background

이슈 프로젝트에서 작업 항목의 상태가 변경될 때, 실적 일정이 자동으로 기록되어야 한다. 현재는 상태 변경 시 `status_id`만 업데이트하고 날짜 필드는 전혀 건드리지 않아, 실적 일정 추적이 불가능한 상태다.

## Goals

- 상태 변경만으로 실적 일정이 자동 기록되어 별도 수동 입력 불필요
- DB 트리거로 구현하여 UI/API 어디에서 변경하든 일관 적용

## Requirements

### Must Have

- **In Progress 진입 시**: `actual_start_date`를 현재 시각으로 설정 (최초 1회만, 기존 값 유지)
- **Resolved 진입 시**: `actual_resolved_date`를 현재 시각으로 설정 (최초 1회만)
- **Closed 진입 시**: `actual_end_date`를 현재 시각으로 설정 (최초 1회만)
- **비완료 상태로 되돌아감**: `actual_resolved_date`, `actual_end_date` 모두 null 초기화
- **Closed → Resolved 되돌림**: `actual_end_date`만 null 초기화
- **이슈 프로젝트만 적용**: `projects.project_type = 'issue'`

### 날짜 필드 매핑

| 상태 | 설정 필드 | 의미 |
|------|-----------|------|
| In Progress | `actual_start_date` | 에이전트가 실제 작업 시작한 시점 |
| Resolved | `actual_resolved_date` | 에이전트가 작업 완료 판단한 시점 |
| Closed | `actual_end_date` | 오케스트레이터가 최종 확인한 시점 |

## Key Decisions

| 결정 사항 | 선택 | 이유 |
|-----------|------|------|
| Resolved용 별도 컬럼 | `actual_resolved_date` 신규 추가 | Resolved(에이전트 완료)와 Closed(최종 확인)를 구분 |
| actual_end_date 시점 | Closed | 오케스트레이터 점검 완료가 진정한 종료 |
| 구현 위치 | DB 트리거 (BEFORE UPDATE) | API/UI 모든 경로에서 일관 적용 |
