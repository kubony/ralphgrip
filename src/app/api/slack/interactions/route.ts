import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

function verifySlackSignature(request: NextRequest, rawBody: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    throw new Error('SLACK_SIGNING_SECRET is not configured')
  }

  const timestamp = request.headers.get('x-slack-request-timestamp')
  const signature = request.headers.get('x-slack-signature')

  if (!timestamp || !signature) {
    return false
  }

  const requestAge = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(requestAge) || requestAge > 60 * 5) {
    return false
  }

  const base = `v0:${timestamp}:${rawBody}`
  const computed = `v0=${createHmac('sha256', signingSecret).update(base).digest('hex')}`
  const computedBuffer = Buffer.from(computed, 'utf8')
  const signatureBuffer = Buffer.from(signature, 'utf8')

  return (
    computedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(computedBuffer, signatureBuffer)
  )
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  try {
    if (!verifySlackSignature(request, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } catch (error) {
    console.error('Slack signature verification setup error:', error)
    return NextResponse.json({ error: 'Slack integration is not configured' }, { status: 500 })
  }

  const contentType = request.headers.get('content-type') || ''

  // Slack URL verification challenge (sent as JSON when saving Request URL)
  if (contentType.includes('application/json')) {
    const body = JSON.parse(rawBody) as { type?: string; challenge?: string }
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge })
    }
  }

  // Interaction payloads (button clicks, etc.) sent as form-urlencoded
  // URL buttons open the link in browser regardless — just acknowledge
  return new Response('', { status: 200 })
}
