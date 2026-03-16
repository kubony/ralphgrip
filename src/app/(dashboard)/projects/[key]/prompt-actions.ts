'use server'

import { readFile } from 'fs/promises'
import path from 'path'

export async function getAgentSystemPrompt(role: string): Promise<string> {
  // Sanitize role to prevent path traversal
  const sanitizedRole = role.replace(/[^a-z0-9-]/gi, '')
  const filePath = path.join(process.cwd(), 'prompts', 'agents', `${sanitizedRole}.md`)
  try {
    const content = await readFile(filePath, 'utf-8')
    return content
  } catch {
    return ''
  }
}
