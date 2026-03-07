export type LinkDomain =
  | 'notion'
  | 'confluence'
  | 'jira'
  | 'github'
  | 'slack'
  | 'google-drive'
  | 'figma'
  | 'generic'

export function detectLinkDomain(url: string): LinkDomain {
  try {
    const hostname = new URL(url).hostname
    if (hostname.includes('notion.so') || hostname.includes('notion.site')) return 'notion'
    if (hostname.includes('confluence') || hostname.endsWith('.atlassian.net/wiki')) return 'confluence'
    if (hostname.includes('jira') || (hostname.endsWith('.atlassian.net') && !hostname.includes('confluence'))) return 'jira'
    if (hostname.includes('github.com')) return 'github'
    if (hostname.includes('slack.com')) return 'slack'
    if (hostname.includes('drive.google.com')) return 'google-drive'
    if (hostname.includes('figma.com')) return 'figma'
    return 'generic'
  } catch {
    return 'generic'
  }
}

export function getDomainLabel(domain: LinkDomain): string {
  const labels: Record<LinkDomain, string> = {
    notion: 'Notion',
    confluence: 'Confluence',
    jira: 'Jira',
    github: 'GitHub',
    slack: 'Slack',
    'google-drive': 'Google Drive',
    figma: 'Figma',
    generic: '외부 링크',
  }
  return labels[domain]
}

export function truncateUrl(url: string, maxLen = 40): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname + parsed.search
    const display = parsed.hostname + (path.length > 1 ? path : '')
    return display.length > maxLen ? display.slice(0, maxLen) + '...' : display
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '...' : url
  }
}
