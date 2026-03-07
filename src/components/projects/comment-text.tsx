import { useMemo } from 'react'

const MENTION_REGEX = /@\[([^\]]+)\]\(user_id:([^)]+)\)/g
const URL_REGEX = /(https?:\/\/[^\s<>)"]+)/g

type Part =
  | { type: 'text'; content: string }
  | { type: 'mention'; content: string; userId: string }
  | { type: 'url'; content: string }

/** 텍스트에서 URL을 분리하여 클릭 가능한 링크로 변환 */
function linkifyText(text: string): Part[] {
  const parts: Part[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_REGEX)) {
    if (match.index! > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'url', content: match[1] })
    lastIndex = match.index! + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }
  return parts
}

export function CommentText({ text }: { text: string }) {
  const parts = useMemo(() => {
    // 1단계: 멘션 파싱
    const mentionParts: Part[] = []
    let lastIndex = 0

    for (const match of text.matchAll(MENTION_REGEX)) {
      if (match.index! > lastIndex) {
        mentionParts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
        })
      }
      mentionParts.push({
        type: 'mention',
        content: match[1],
        userId: match[2],
      })
      lastIndex = match.index! + match[0].length
    }
    if (lastIndex < text.length) {
      mentionParts.push({ type: 'text', content: text.slice(lastIndex) })
    }

    // 2단계: 텍스트 부분에서 URL 파싱
    const result: Part[] = []
    for (const part of mentionParts) {
      if (part.type === 'text') {
        result.push(...linkifyText(part.content))
      } else {
        result.push(part)
      }
    }

    return result
  }, [text])

  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.type === 'mention') {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20"
              title={`User ID: ${part.userId}`}
            >
              @{part.content}
            </span>
          )
        }
        if (part.type === 'url') {
          return (
            <a
              key={i}
              href={part.content}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 break-all"
            >
              {part.content}
            </a>
          )
        }
        return <span key={i}>{part.content}</span>
      })}
    </p>
  )
}

/** Extract mentioned user IDs from text (for notifications) */
export function extractMentionedUserIds(text: string): string[] {
  const regex = /@\[[^\]]+\]\(user_id:([^)]+)\)/g
  return [...text.matchAll(regex)].map((m) => m[1])
}
