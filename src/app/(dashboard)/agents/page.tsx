import { getAccessibleAgents } from './actions'
import { AgentsPageContent } from '@/components/agents/agents-page-content'

export default async function AgentsPage() {
  const result = await getAccessibleAgents()
  const agents = result.data ?? []

  return <AgentsPageContent initialAgents={agents} />
}
