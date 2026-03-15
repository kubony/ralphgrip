import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerWorkItemTools } from './tools/work-items.js';
import { registerProjectMetaTools } from './tools/project-meta.js';
const server = new McpServer({
    name: 'agentgrip',
    version: '0.1.0',
});
registerWorkItemTools(server);
registerProjectMetaTools(server);
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map