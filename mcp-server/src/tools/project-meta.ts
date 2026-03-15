import { z } from 'zod'
import { supabase, getProjectId } from '../supabase.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerProjectMetaTools(server: McpServer) {
  server.tool(
    'get_project_meta',
    'Get project metadata including available statuses and trackers. Call this first to understand what status/tracker names you can use.',
    {},
    async () => {
      const projectId = getProjectId()

      const [statusesRes, trackersRes, projectRes] = await Promise.all([
        supabase
          .from('statuses')
          .select('id, name, color, position, is_closed')
          .eq('project_id', projectId)
          .order('position'),
        supabase
          .from('trackers')
          .select('id, name, color, position')
          .eq('project_id', projectId)
          .order('position'),
        supabase
          .from('projects')
          .select('id, name, key, description')
          .eq('id', projectId)
          .single(),
      ])

      if (statusesRes.error) {
        return { content: [{ type: 'text' as const, text: `Error fetching statuses: ${statusesRes.error.message}` }] }
      }
      if (trackersRes.error) {
        return { content: [{ type: 'text' as const, text: `Error fetching trackers: ${trackersRes.error.message}` }] }
      }
      if (projectRes.error) {
        return { content: [{ type: 'text' as const, text: `Error fetching project: ${projectRes.error.message}` }] }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project: projectRes.data,
            statuses: statusesRes.data,
            trackers: trackersRes.data,
          }, null, 2),
        }],
      }
    }
  )
}
