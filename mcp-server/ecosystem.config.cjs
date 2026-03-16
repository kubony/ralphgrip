module.exports = {
  apps: [
    {
      name: 'agentgrip-mcp',
      script: 'dist/index.js',
      args: '--transport http --port 3001',
      cwd: '/home/inkeun/agentgrip/mcp-server',
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
        AGENTGRIP_SUPABASE_URL: process.env.AGENTGRIP_SUPABASE_URL || '',
        AGENTGRIP_SERVICE_KEY: process.env.AGENTGRIP_SERVICE_KEY || '',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      error_file: '/home/inkeun/logs/agentgrip-mcp-error.log',
      out_file: '/home/inkeun/logs/agentgrip-mcp-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
