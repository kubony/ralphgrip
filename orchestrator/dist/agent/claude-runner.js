import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createLogger } from '../logger.js';
const log = createLogger('claude-runner');
export class ClaudeRunner {
    proc = null;
    config;
    constructor(config) {
        this.config = config;
    }
    async run(prompt, cwd, opts) {
        const startTime = Date.now();
        const usage = { input_tokens: 0, output_tokens: 0 };
        const args = [
            '--print',
            '--output-format', 'stream-json',
            '--model', this.config.model,
            '--max-turns', String(this.config.maxTurns),
            '--allowedTools', this.config.allowedTools.join(','),
        ];
        if (opts?.continuation) {
            args.push('--continue');
        }
        args.push('-p', prompt);
        log.info('Launching Claude Code', {
            cwd,
            model: this.config.model,
            maxTurns: this.config.maxTurns,
            continuation: opts?.continuation ?? false,
        });
        return new Promise((resolve) => {
            this.proc = spawn('claude', args, {
                cwd,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, CLAUDECODE: '' },
            });
            let result;
            let error;
            let settled = false;
            const settle = (success) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(stallTimer);
                clearTimeout(turnTimer);
                resolve({
                    success,
                    result,
                    error,
                    usage,
                    durationMs: Date.now() - startTime,
                });
            };
            // Stall detection
            let stallTimer = setTimeout(() => {
                log.warn('Stall detected, killing process', { stallTimeoutMs: this.config.stallTimeoutMs });
                error = `Stall detected: no output for ${this.config.stallTimeoutMs}ms`;
                this.kill();
                settle(false);
            }, this.config.stallTimeoutMs);
            const resetStallTimer = () => {
                clearTimeout(stallTimer);
                stallTimer = setTimeout(() => {
                    log.warn('Stall detected, killing process');
                    error = `Stall detected: no output for ${this.config.stallTimeoutMs}ms`;
                    this.kill();
                    settle(false);
                }, this.config.stallTimeoutMs);
            };
            // Overall turn timeout
            const turnTimer = setTimeout(() => {
                log.warn('Turn timeout reached, killing process', { turnTimeoutMs: this.config.turnTimeoutMs });
                error = `Turn timeout: exceeded ${this.config.turnTimeoutMs}ms`;
                this.kill();
                settle(false);
            }, this.config.turnTimeoutMs);
            // Abort signal
            if (opts?.signal) {
                opts.signal.addEventListener('abort', () => {
                    error = 'Aborted';
                    this.kill();
                    settle(false);
                }, { once: true });
            }
            // Parse stdout line by line as stream-json
            const rl = createInterface({ input: this.proc.stdout });
            rl.on('line', (line) => {
                resetStallTimer();
                try {
                    const event = JSON.parse(line);
                    switch (event.type) {
                        case 'assistant':
                            log.debug('Assistant message', { content: event.message?.content?.slice(0, 200) });
                            break;
                        case 'tool_use':
                            log.debug('Tool use', { tool: event.tool });
                            break;
                        case 'result': {
                            const resultEvent = event;
                            result = resultEvent.result;
                            if (resultEvent.usage) {
                                usage.input_tokens += resultEvent.usage.input_tokens;
                                usage.output_tokens += resultEvent.usage.output_tokens;
                            }
                            if (resultEvent.is_error) {
                                error = resultEvent.result;
                                log.error('Claude Code returned error', { error });
                            }
                            else {
                                log.info('Claude Code completed successfully', {
                                    tokens: usage,
                                    durationMs: Date.now() - startTime,
                                });
                            }
                            break;
                        }
                        case 'error':
                            error = event.error?.message ?? 'Unknown error';
                            log.error('Stream error', { error });
                            break;
                    }
                }
                catch {
                    // Non-JSON line, ignore
                }
            });
            // Collect stderr
            let stderr = '';
            this.proc.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            this.proc.on('close', (code) => {
                clearTimeout(stallTimer);
                clearTimeout(turnTimer);
                if (code !== 0 && !error) {
                    error = `Process exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`;
                }
                settle(!error);
            });
            this.proc.on('error', (err) => {
                error = `Failed to spawn claude: ${err.message}`;
                log.error(error);
                settle(false);
            });
        });
    }
    kill() {
        if (this.proc && !this.proc.killed) {
            this.proc.kill('SIGTERM');
            // Force kill after 5 seconds
            setTimeout(() => {
                if (this.proc && !this.proc.killed) {
                    this.proc.kill('SIGKILL');
                }
            }, 5000);
        }
    }
}
//# sourceMappingURL=claude-runner.js.map