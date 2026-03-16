module.exports = {
  apps: [
    {
      name: 'ralphgrip-mcp',
      script: 'dist/index.js',
      args: '--transport http --port 3001',
      cwd: '/home/inkeun/ralphgrip/mcp-server',
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
        RALPHGRIP_SUPABASE_URL: process.env.RALPHGRIP_SUPABASE_URL || '',
        RALPHGRIP_SERVICE_KEY: process.env.RALPHGRIP_SERVICE_KEY || '',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      error_file: '/home/inkeun/logs/ralphgrip-mcp-error.log',
      out_file: '/home/inkeun/logs/ralphgrip-mcp-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
