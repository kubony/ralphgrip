import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/service'

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) return null
  return res.json()
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const folderId = request.nextUrl.searchParams.get('folderId')

  if (!folderId) {
    return NextResponse.json({ error: 'folderId is required' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
    return NextResponse.json({ error: 'Invalid folderId format' }, { status: 400 })
  }

  // DB에서 사용자의 Google 토큰 조회
  const admin = getServiceClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expires_at')
    .eq('id', user.id)
    .single()

  if (!profile?.google_access_token) {
    return NextResponse.json(
      { error: 'drive_scope_missing', message: 'Google Drive 권한이 없습니다. 재로그인해주세요.' },
      { status: 403 }
    )
  }

  let accessToken = profile.google_access_token

  // 토큰 만료 시 자동 갱신
  const isExpired = profile.google_token_expires_at
    ? new Date(profile.google_token_expires_at) < new Date()
    : false

  if (isExpired && profile.google_refresh_token) {
    const refreshed = await refreshGoogleToken(profile.google_refresh_token)
    if (refreshed) {
      accessToken = refreshed.access_token
      await admin.from('profiles').update({
        google_access_token: accessToken,
        google_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }).eq('id', user.id)
    }
  }

  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
      orderBy: 'name',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    return NextResponse.json({ files: response.data.files ?? [] })
  } catch (err: unknown) {
    const googleError = err as { code?: number }

    if (googleError.code === 401) {
      return NextResponse.json(
        { error: 'token_expired', message: '세션이 만료되었습니다. 재로그인해주세요.' },
        { status: 401 }
      )
    }
    if (googleError.code === 403) {
      return NextResponse.json(
        { error: 'access_denied', message: '이 폴더에 접근 권한이 없습니다.' },
        { status: 403 }
      )
    }
    if (googleError.code === 404) {
      return NextResponse.json(
        { error: 'not_found', message: '폴더를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    console.error('Drive API error:', err)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}
