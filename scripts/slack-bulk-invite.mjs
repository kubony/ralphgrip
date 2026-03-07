import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// .env.local 파싱
const envContent = readFileSync('.env.local', 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=["']?(.+?)["']?$/)
  if (match) env[match[1].trim()] = match[2].trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const token = env.SLACK_BOT_TOKEN

const projectId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
const channelId = 'C0ADZMMNB3P'

const { data: members } = await supabase
  .from('project_members')
  .select('id, role, profiles(email, full_name)')
  .eq('project_id', projectId)

console.log('=== TYMPROTO 프로젝트 멤버 ===')
for (const m of members) {
  console.log(`  ${m.profiles.email} - ${m.profiles.full_name} (${m.role})`)
}
console.log(`총 ${members.length}명\n`)

for (const m of members) {
  const email = m.profiles.email

  const lookupRes = await fetch(
    `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const lookupData = await lookupRes.json()

  if (!lookupData.ok) {
    console.log(`[SKIP] ${email} - ${lookupData.error}`)
    continue
  }

  const slackUserId = lookupData.user.id
  const slackName = lookupData.user.real_name

  const inviteRes = await fetch('https://slack.com/api/conversations.invite', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel: channelId, users: slackUserId }),
  })
  const inviteData = await inviteRes.json()

  if (inviteData.ok) {
    console.log(`[OK] ${email} (${slackName}) → 채널 초대 성공`)
  } else if (inviteData.error === 'already_in_channel') {
    console.log(`[ALREADY] ${email} (${slackName}) → 이미 채널에 있음`)
  } else {
    console.log(`[FAIL] ${email} (${slackName}) → ${inviteData.error}`)
  }
}

console.log('\n완료!')
