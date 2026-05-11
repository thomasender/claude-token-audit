import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { SessionFile, SessionMessage, RedundantRead, TokenSink, ReasoningFlag } from './types.js';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

export function findSessionFiles(): string[] {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    return [];
  }

  const files: string[] = [];

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(full);
      } else if (entry.name.endsWith('.jsonl')) {
        files.push(full);
      }
    }
  }

  walkDir(CLAUDE_PROJECTS_DIR);
  return files;
}

export function parseSessionFile(filePath: string): SessionFile | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const messages: SessionMessage[] = [];
    let totalTokens = 0;
    let totalThinkingTokens = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        messages.push(obj);

        // Accumulate tokens — support multiple formats
        if (obj.tokens) totalTokens += obj.tokens;
        if (obj.thinking_tokens) totalThinkingTokens += obj.thinking_tokens;
        if (obj.input_tokens) totalInputTokens += obj.input_tokens;
        if (obj.output_tokens) totalOutputTokens += obj.output_tokens;

        // Also check inside message content blocks for token info
        if (obj.usage) {
          totalTokens += obj.usage.total_tokens || 0;
          totalThinkingTokens += obj.usage.thinking_tokens || 0;
          totalInputTokens += obj.usage.prompt_tokens || 0;
          totalOutputTokens += obj.usage.completion_tokens || 0;
        }
      } catch {
        // Skip malformed lines
      }
    }

    const projectPath = path.dirname(filePath);

    return {
      path: filePath,
      projectPath,
      messages,
      totalTokens,
      totalThinkingTokens,
      totalInputTokens,
      totalOutputTokens,
    };
  } catch {
    return null;
  }
}

export function findRedundantReads(session: SessionFile): RedundantRead[] {
  const readCounts = new Map<string, number>();
  const readSizes = new Map<string, number>();

  for (const msg of session.messages) {
    const content = msg.content;
    if (content && typeof content !== 'string') {
      for (const block of content) {
        if (block.type === 'read_file' || block.type === 'read') {
          let fileKey = '';
          let size = 0;

          if (block.source?.path) {
            fileKey = block.source.path;
          } else if (block.source?.type === 'file' && block.source?.path) {
            fileKey = block.source.path;
          }

          if (block.content) {
            size = block.content.length;
          }

          if (fileKey) {
            readCounts.set(fileKey, (readCounts.get(fileKey) || 0) + 1);
            // Keep the largest size estimate
            if (!readSizes.has(fileKey) || size > (readSizes.get(fileKey) || 0)) {
              readSizes.set(fileKey, size);
            }
          }
        }
      }
    }
  }

  const redundant: RedundantRead[] = [];
  for (const [file, count] of readCounts) {
    if (count > 1) {
      const estimatedTokens = Math.ceil((readSizes.get(file) || 0) / 4) * (count - 1);
      redundant.push({ file, count, estimatedTokens });
    }
  }

  return redundant.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
}

export function findTokenSinks(session: SessionFile): TokenSink[] {
  const sinks: TokenSink[] = [];

  for (const msg of session.messages) {
    const content = msg.content;
    if (content && typeof content !== 'string') {
      for (const block of content) {
        if (block.type === 'bash' || block.type === 'terminal') {
          const text = block.text || block.content || '';
          if (text.length > 2000) {
            // Likely outputting too much
            const estimatedTokens = Math.ceil(text.length / 4);
            let suggestion = 'Consider adding this directory to .claudeignore';

            if (text.includes('node_modules') || text.includes('.git')) {
              suggestion = 'Add node_modules or .git to .claudeignore';
            } else if (text.includes('dist') || text.includes('build')) {
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

export function findReasoningFlags(session: SessionFile): ReasoningFlag[] {
  const flags: ReasoningFlag[] = [];

  if (session.totalTokens === 0) return flags;

  const thinkingPercent = (session.totalThinkingTokens / session.totalTokens) * 100;

  // Flag only when thinking > 20% and total tokens suggest a non-complex task
  if (thinkingPercent > 20 && session.totalTokens < 50000) {
    flags.push({
      session: path.basename(session.path),
      thinkingPercent: Math.round(thinkingPercent * 10) / 10,
      totalTokens: session.totalTokens,
    });
  }

  return flags;
}