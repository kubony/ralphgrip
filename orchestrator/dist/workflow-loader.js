import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Liquid } from 'liquidjs';
import { WorkflowConfigSchema, resolveEnvVarsDeep } from './config.js';
import { createLogger } from './logger.js';
const log = createLogger('workflow-loader');
export class WorkflowLoader {
    filePath;
    config;
    promptTemplate;
    liquid = new Liquid();
    watcher = null;
    changeCallbacks = [];
    constructor(filePath) {
        this.filePath = filePath;
        this.load();
    }
    load() {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
        if (!match) {
            throw new Error(`Invalid WORKFLOW.md format: missing YAML front matter in ${this.filePath}`);
        }
        const [, yamlStr, template] = match;
        const parsed = parseYaml(yamlStr);
        const resolved = resolveEnvVarsDeep(parsed);
        const validated = WorkflowConfigSchema.parse(resolved);
        // Expand ~ in workspace.root
        if (validated.workspace.root.startsWith('~')) {
            validated.workspace.root = path.join(os.homedir(), validated.workspace.root.slice(1));
        }
        validated.workspace.root = path.resolve(validated.workspace.root);
        this.config = validated;
        this.promptTemplate = template.trim();
        log.info('Workflow config loaded', { path: this.filePath });
    }
    getConfig() {
        return this.config;
    }
    async renderPrompt(vars) {
        return this.liquid.parseAndRender(this.promptTemplate, vars);
    }
    onChange(cb) {
        this.changeCallbacks.push(cb);
        if (!this.watcher) {
            let debounceTimer = null;
            this.watcher = fs.watch(this.filePath, () => {
                if (debounceTimer)
                    clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    try {
                        this.load();
                        for (const callback of this.changeCallbacks)
                            callback();
                        log.info('Workflow config reloaded');
                    }
                    catch (err) {
                        log.error('Failed to reload workflow config', {
                            error: err instanceof Error ? err.message : String(err),
                        });
                    }
                }, 500);
            });
        }
    }
    close() {
        this.watcher?.close();
        this.watcher = null;
        this.changeCallbacks = [];
    }
}
//# sourceMappingURL=workflow-loader.js.map