/**
 * Google Identity Services (GIS) 토큰 모델 타입 선언
 * @see https://developers.google.com/identity/oauth2/web/reference/js-reference
 */

declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: string; hint?: string }): void
  }

  interface TokenClientConfig {
    client_id: string
    scope: string
    callback: (response: {
      access_token: string
      expires_in: number
      scope: string
      token_type: string
    }) => void
    error_callback?: (error: { type: string; message?: string }) => void
    prompt?: string
    hint?: string
  }

  function initTokenClient(config: TokenClientConfig): TokenClient
}
