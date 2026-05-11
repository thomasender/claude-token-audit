import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionMessageSchema } from './types.js';
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export function findSessionFiles(dir) {
    const baseDir = dir ?? CLAUDE_PROJECTS_DIR;
    if (!fs.existsSync(baseDir))
        return [];
    const files = [];
    function walkDir(d) {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isSymbolicLink())
                continue;
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                walkDir(full);
            }
            else if (entry.name.endsWith('.jsonl')) {
                files.push(full);
            }
        }
    }
    walkDir(baseDir);
    return files;
}
export function parseSessionFile(filePath) {
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE)
            return null;
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        const messages = [];
        let totalTokens = 0;
        let totalThinkingTokens = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        for (const line of lines) {
            try {
                const raw = JSON.parse(line);
                const parsed = SessionMessageSchema.safeParse(raw);
                if (!parsed.success)
                    continue;
                const obj = parsed.data;
                messages.push(obj);
                // Prioritize usage object to avoid double-counting across formats
                if (obj.usage) {
                    const inputTok = obj.usage.input_tokens ?? obj.usage.prompt_tokens ?? 0;
                    const outputTok = obj.usage.output_tokens ?? obj.usage.completion_tokens ?? 0;
                    totalTokens += obj.usage.total_tokens ?? (inputTok + outputTok);
                    totalThinkingTokens += obj.usage.thinking_tokens ?? 0;
                    totalInputTokens += inputTok;
                    totalOutputTokens += outputTok;
                }
                else {
                    totalTokens += obj.tokens ?? 0;
                    totalThinkingTokens += obj.thinking_tokens ?? 0;
                    totalInputTokens += obj.input_tokens ?? 0;
                    totalOutputTokens += obj.output_tokens ?? 0;
                }
            }
            catch {
                // Skip malformed lines
            }
        }
        return {
            path: filePath,
            projectPath: path.dirname(filePath),
            messages,
            totalTokens,
            totalThinkingTokens,
            totalInputTokens,
            totalOutputTokens,
        };
    }
    catch {
        return null;
    }
}
export function findRedundantReads(session) {
    const readCounts = new Map();
    const readSizes = new Map();
    for (const msg of session.messages) {
        const content = msg.content;
        if (content && typeof content !== 'string') {
            for (const block of content) {
                if (block.type === 'read_file' || block.type === 'read') {
                    let fileKey = '';
                    let size = 0;
                    if (block.source?.path) {
                        fileKey = block.source.path;
                    }
                    if (block.content) {
                        size = block.content.length;
                    }
                    if (fileKey) {
                        readCounts.set(fileKey, (readCounts.get(fileKey) ?? 0) + 1);
                        if (!readSizes.has(fileKey) || size > (readSizes.get(fileKey) ?? 0)) {
                            readSizes.set(fileKey, size);
                        }
                    }
                }
            }
        }
    }
    const redundant = [];
    for (const [file, count] of readCounts) {
        if (count > 1) {
            // ~4 chars/token is a rough approximation; actual BPE varies by content type
            const estimatedTokens = Math.ceil((readSizes.get(file) ?? 0) / 4) * (count - 1);
            redundant.push({ file, count, estimatedTokens });
        }
    }
    return redundant.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
}
export function findTokenSinks(session) {
    const sinks = [];
    for (const msg of session.messages) {
        const content = msg.content;
        if (content && typeof content !== 'string') {
            for (const block of content) {
                if (block.type === 'bash' || block.type === 'terminal') {
                    const text = block.text ?? block.content ?? '';
                    if (text.length > 2000) {
                        const estimatedTokens = Math.ceil(text.length / 4);
                        let suggestion = 'Consider adding this directory to .claudeignore';
                        if (text.includes('node_modules') || text.includes('.git')) {
                            suggestion = 'Add node_modules or .git to .claudeignore';
                        }
                        else if (text.includes('dist') || text.includes('build')) {
                            suggestion = 'Add build/ or dist/ to .claudeignore';
                        }
                        sinks.push({ command: text.substring(0, 80), estimatedTokens, suggestion });
                    }
                }
            }
        }
    }
    return sinks.sort((a, b) => b.estimatedTokens - a.estimatedTokens).slice(0, 5);
}
export function findReasoningFlags(session) {
    if (session.totalTokens === 0)
        return [];
    const thinkingPercent = (session.totalThinkingTokens / session.totalTokens) * 100;
    if (thinkingPercent > 20 && session.totalTokens < 50000) {
        return [{
                session: path.basename(session.path),
                thinkingPercent: Math.round(thinkingPercent * 10) / 10,
                totalTokens: session.totalTokens,
            }];
    }
    return [];
}
