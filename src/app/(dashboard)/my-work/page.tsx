import { redirect } from 'next/navigation'

// 레거시 경로 → 오케스트레이터 인박스로 영구 리다이렉트
export default function MyWorkRedirect() {
  redirect('/inbox')
}
