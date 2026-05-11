#!/usr/bin/env node

import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import {
  findSessionFiles,
  parseSessionFile,
  findRedundantReads,
  findTokenSinks,
  findReasoningFlags,
} from './logParser.js';
import { auditConfig } from './configAudit.js';
import type {
  AuditResult,
  SessionFile,
  RedundantRead,
  TokenSink,
  ReasoningFlag,
  ConfigAudit,
  ActionItem,
} from './types.js';
import {
  printBanner,
  printEfficiencyScore,
  printSummary,
  printTopActions,
  printRedundantReads,
  printTokenSinks,
  printReasoningFlags,
  printConfigAudit,
  printNoDataFound,
  printFooter,
} from './output.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('claude-session-profiler')
  .description('Profile Claude Code session logs to identify token waste and efficiency improvements')
  .version(pkg.version)
  .option('-p, --projects <path>', 'Path to ~/.claude/projects directory', path.join(os.homedir(), '.claude', 'projects'))
  .option('-s, --session <path>', 'Profile a specific session file')
  .option('--json', 'Output results as JSON')
  .action(async (opts) => {
    const result = await runAudit(opts);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    }
  });

async function runAudit(opts: { projects?: string; session?: string; json?: boolean }): Promise<AuditResult> {
  let sessionFiles: string[] = [];

  if (opts.session) {
    const resolved = path.resolve(opts.session);
    if (!fs.existsSync(resolved)) {
      console.error(`Session file not found: ${resolved}`);
      process.exit(1);
    }
    if (!fs.statSync(resolved).isFile()) {
      console.error(`Not a file: ${resolved}`);
      process.exit(1);
    }
    if (!resolved.endsWith('.jsonl')) {
      console.error(`Session file must have .jsonl extension: ${resolved}`);
      process.exit(1);
    }
    sessionFiles = [resolved];
  } else {
    const projectsDir = opts.projects ?? path.join(os.homedir(), '.claude', 'projects');
    sessionFiles = findSessionFiles(projectsDir);
  }

  if (sessionFiles.length === 0) {
    if (!opts.json) { printBanner(); printNoDataFound(); }
    process.exit(0);
  }

  const sessions: SessionFile[] = [];
  for (const file of sessionFiles) {
    const session = parseSessionFile(file);
    if (session) sessions.push(session);
  }

  if (sessions.length === 0) {
    if (!opts.json) { printBanner(); printNoDataFound(); }
    process.exit(0);
  }

  const allRedundantReads: RedundantRead[] = [];
  const allTokenSinks: TokenSink[] = [];
  const allReasoningFlags: ReasoningFlag[] = [];

  for (const session of sessions) {
    allRedundantReads.push(...findRedundantReads(session));
    allTokenSinks.push(...findTokenSinks(session));
    allReasoningFlags.push(...findReasoningFlags(session));
  }

  const mostRecentSession = sessions[sessions.length - 1];
  const configAudit = auditConfig(mostRecentSession.projectPath ?? process.cwd());

  const totalTokensUsed = sessions.reduce((sum, s) => sum + s.totalTokens, 0);

  const redundantTokens = allRedundantReads.reduce((sum, r) => sum + r.estimatedTokens, 0);
  const sinkTokens = allTokenSinks.reduce((sum, s) => sum + s.estimatedTokens, 0);
  const estimatedSavingsPercent = totalTokensUsed > 0
    ? Math.min(Math.round(((redundantTokens + sinkTokens) / totalTokensUsed) * 100), 50)
    : 0;

  const { efficiencyScore, efficiencyGrade } = calculateGrade(
    estimatedSavingsPercent, allRedundantReads.length, allTokenSinks.length, configAudit
  );

  const topActions = buildTopActions(allRedundantReads, allTokenSinks, configAudit, estimatedSavingsPercent);

  const result: AuditResult = {
    efficiencyScore,
    efficiencyGrade,
    totalSessionsAnalyzed: sessions.length,
    totalTokensUsed,
    estimatedSavingsPercent,
    topActions,
    redundantReads: allRedundantReads.slice(0, 5),
    tokenSinks: allTokenSinks.slice(0, 5),
    reasoningFlags: allReasoningFlags.slice(0, 3),
    configAudit,
  };

  if (!opts.json) {
    printBanner();
    printEfficiencyScore(result);
    printSummary(result);
    printTopActions(result.topActions);
    printRedundantReads(result.redundantReads);
    printTokenSinks(result.tokenSinks);
    printReasoningFlags(result.reasoningFlags);
    printConfigAudit(result.configAudit);
    printFooter();
  }

  return result;
}

function calculateGrade(
  savings: number,
  redundantCount: number,
  sinkCount: number,
  config: ConfigAudit
): { efficiencyScore: string; efficiencyGrade: string } {
  let score = 100;

  score -= redundantCount * 5;
  score -= sinkCount * 3;
  if (!config.claudeignorePresent) score -= 15;
  if (config.claudeMdSize > 1000) score -= 10;
  score -= config.issues.length * 5;
  score += savings;

  score = Math.max(0, Math.min(100, score));

  let grade: string;
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  return { efficiencyScore: `${score}/100`, efficiencyGrade: grade };
}

function buildTopActions(
  redundantReads: RedundantRead[],
  tokenSinks: TokenSink[],
  config: ConfigAudit,
  savings: number
): ActionItem[] {
  const actions: ActionItem[] = [];

  if (!config.claudeignorePresent) {
    actions.push({
      priority: 1,
      title: 'Create .claudeignore',
      description: 'Create a .claudeignore file in your project root. Add: node_modules, dist, .git, build',
      estimatedSavingsPercent: 15,
    });
  }

  if (redundantReads.length > 0) {
    const top = redundantReads[0];
    const fileName = top.file.split('/').pop() ?? top.file;
    actions.push({
      priority: 2,
      title: `Cache repeated reads of ${fileName}`,
      description: `This file was read ${top.count} times. Use session context or ask to summarize instead of re-reading.`,
      estimatedSavingsPercent: Math.min(Math.ceil(top.count * 3), 12),
    });
  }

  if (tokenSinks.length > 0) {
    actions.push({
      priority: 3,
      title: 'Add build artifacts to .claudeignore',
      description: 'Large command outputs detected. Add build/ or dist/ to .claudeignore to avoid scanning generated files.',
      estimatedSavingsPercent: 8,
    });
  }

  if (config.claudeMdSize > 1000) {
    actions.push({
      priority: 4,
      title: 'Modularize CLAUDE.md',
      description: `CLAUDE.md is ${config.claudeMdSize} tokens. Split into focused files (ARCHITECTURE.md, RULES.md) and reference them.`,
      estimatedSavingsPercent: 10,
    });
  }

  return actions.slice(0, 3);
}

program.parse();
