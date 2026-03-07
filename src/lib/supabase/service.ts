import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service Role 클라이언트: RLS 우회, unstable_cache 내부에서 사용
// (세션 쿠키 불필요 → 크로스-요청 캐시에 적합)
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
