/**
 * lucide-react 직접 임포트를 위한 타입 선언
 * Vercel 베스트 프랙티스: 직접 임포트로 번들 크기 최적화
 */

declare module 'lucide-react/dist/esm/icons/*' {
  import { LucideIcon } from 'lucide-react'
  const icon: LucideIcon
  export default icon
}
