'use client'

import { useCallback, useEffect, useRef } from 'react'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')

interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
}

/**
 * Google Identity Services (GIS) 토큰 모델 훅
 *
 * Export 시점에 requestToken()을 호출하면
 * Google OAuth 팝업이 열리고 access_token을 Promise로 반환합니다.
 */
export function useGoogleToken() {
  const clientRef = useRef<google.accounts.oauth2.TokenClient | null>(null)
  const resolveRef = useRef<((token: string) => void) | null>(null)
  const rejectRef = useRef<((error: Error) => void) | null>(null)
  const scriptLoaded = useRef(false)

  const initClient = useCallback((
    clientId: string,
    resolve: (token: string) => void,
    reject: (error: Error) => void,
  ) => {
    resolveRef.current = resolve
    rejectRef.current = reject

    if (!clientRef.current) {
      clientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response: TokenResponse) => {
          if (response.access_token) {
            resolveRef.current?.(response.access_token)
          } else {
            rejectRef.current?.(new Error('토큰 발급에 실패했습니다.'))
          }
          resolveRef.current = null
          rejectRef.current = null
        },
        error_callback: (error: { type: string; message?: string }) => {
          rejectRef.current?.(new Error(error.message || '인증이 취소되었습니다.'))
          resolveRef.current = null
          rejectRef.current = null
        },
      })
    }

    clientRef.current.requestAccessToken()
  }, [])

  // GIS 스크립트 로드
  useEffect(() => {
    if (scriptLoaded.current) return
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      scriptLoaded.current = true
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => { scriptLoaded.current = true }
    document.head.appendChild(script)
  }, [])

  const requestToken = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      if (!clientId) {
        reject(new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID 환경변수가 설정되지 않았습니다.'))
        return
      }

      // GIS 스크립트 로드 대기
      const waitForGis = (retries = 20) => {
        if (typeof google !== 'undefined' && google.accounts?.oauth2) {
          initClient(clientId, resolve, reject)
        } else if (retries > 0) {
          setTimeout(() => waitForGis(retries - 1), 100)
        } else {
          reject(new Error('Google Identity Services 로드에 실패했습니다.'))
        }
      }

      waitForGis()
    })
  }, [initClient])

  return { requestToken }
}
