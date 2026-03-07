import { describe, expect, it } from 'vitest'

import { extractMentionedUserIds, stripMentionMarkup } from '@/lib/notifications'

describe('notifications helpers', () => {
  it('extractMentionedUserIds deduplicates mentioned user ids', () => {
    const text = [
      '@[Alice](user_id:user-1)',
      'hello',
      '@[Bob](user_id:user-2)',
      '@[Alice](user_id:user-1)',
    ].join(' ')

    expect(extractMentionedUserIds(text)).toEqual(['user-1', 'user-2'])
  })

  it('stripMentionMarkup converts mention markup to plain @name text', () => {
    const text = '담당자 @[Alice Kim](user_id:user-1) 와 @[Bob](user_id:user-2) 확인'

    expect(stripMentionMarkup(text)).toBe('담당자 @Alice Kim 와 @Bob 확인')
  })
})
