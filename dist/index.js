#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import { parseSessionFile, findRedundantReads, findTokenSinks, findReasoningFlags, } from './logParser.js';
import { auditConfig } from './configAudit.js';
import { printBanner, printEfficiencyScore, printSummary, printTopActions, printRedundantReads, printTokenSinks, printReasoningFlags, printConfigAudit, printNoDataFound, printFooter, } from './output.js';
const program = new Command();
program
    .name('claude-context-optics')
    .description('Audit Claude Code usage logs and project configs for token-saving recommendations')
    .version('1.0.0')
    .option('-p, --projects <path>', 'Path to ~/.claude/projects directory', path.join(os.homedir(), '.claude', 'projects'))
    .option('-s, --session <path>', 'Audit a specific session file')
    .option('--json', 'Output results as JSON')
    .action(async (opts) => {
    const result = await runAudit(opts);
    if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
    }
});
async function runAudit(opts) {
    // Find session files
    let sessionFiles = [];
    if (opts.session) {
        if (sessionFiles.includes(opts.session) || opts.session.endsWith('.jsonl')) {
            sessionFiles = [opts.session];
        }
    }
    else {
        // Use default location or custom path
        const projectsDir = opts.projects || path.join(os.homedir(), '.claude', 'projects');
        if (fs.existsSync(projectsDir)) {
            sessionFiles = findSessionFilesInDir(projectsDir);
        }
    }
    if (sessionFiles.length === 0) {
        printBanner();
        printNoDataFound();
        process.exit(0);
    }
    // Parse all sessions
    const sessions = [];
    for (const file of sessionFiles) {
        const session = parseSessionFile(file);
        if (session)
            sessions.push(session);
    }
    if (sessions.length === 0) {
        printBanner();
        printNoDataFound();
        process.exit(0);
    }
    // Aggregate analysis
    const allRedundantReads = [];
    const allTokenSinks = [];
    const allReasoningFlags = [];
    for (const session of sessions) {
        allRedundantReads.push(...findRedundantReads(session));
        allTokenSinks.push(...findTokenSinks(session));
        allReasoningFlags.push(...findReasoningFlags(session));
    }
    // Config audit — use most recent session's project or cwd
    const mostRecentSession = sessions[sessions.length - 1];
    const configAudit = auditConfig(mostRecentSession.projectPath || process.cwd());
    // Calculate totals
    const totalTokensUsed = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
    // Estimate savings
    const redundantTokens = allRedundantReads.reduce((sum, r) => sum + r.estimatedTokens, 0);
    const sinkTokens = allTokenSinks.reduce((sum, s) => sum + s.estimatedTokens, 0);
    const estimatedSavingsPercent = totalTokensUsed > 0
        ? Math.min(Math.round(((redundantTokens + sinkTokens) / totalTokensUsed) * 100), 50)
        : 0;
    // Determine grade
    const { efficiencyScore, efficiencyGrade } = calculateGrade(estimatedSavingsPercent, allRedundantReads.length, allTokenSinks.length, configAudit);
    // Build top actions
    const topActions = buildTopActions(allRedundantReads, allTokenSinks, configAudit, estimatedSavingsPercent);
    const result = {
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
    // Output
    printBanner();
    printEfficiencyScore(result);
    printSummary(result);
    printTopActions(result.topActions);
    printRedundantReads(result.redundantReads);
    printTokenSinks(result.tokenSinks);
    printReasoningFlags(result.reasoningFlags);
    printConfigAudit(result.configAudit);
    printFooter();
    return result;
}
function findSessionFilesInDir(dir) {
    const files = [];
    if (!fs.existsSync(dir))
        return files;
    function walk(d) {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            }
            else if (entry.name.endsWith('.jsonl')) {
                files.push(full);
            }
        }
    }
    walk(dir);
    return files;
}
function calculateGrade(savings, redundantCount, sinkCount, config) {
    let score = 100;
    // Deduct for issues
    score -= redundantCount * 5;
    score -= sinkCount * 3;
    if (!config.claudeignorePresent)
        score -= 15;
    if (config.claudeMdSize > 1000)
        score -= 10;
    score -= config.issues.length * 5;
    // Boost for savings
    score += savings;
    score = Math.max(0, Math.min(100, score));
    let grade;
    if (score >= 90)
        grade = 'A';
    else if (score >= 75)
        grade = 'B';
    else if (score >= 60)
        grade = 'C';
    else if (score >= 40)
        grade = 'D';
    else
        grade = 'F';
    return { efficiencyScore: `${score}/100`, efficiencyGrade: grade };
}
function buildTopActions(redundantReads, tokenSinks, config, savings) {
    const actions = [];
    // Check .claudeignore first (highest impact)
    if (!config.claudeignorePresent) {
        actions.push({
            priority: 1,
            title: 'Create .claudeignore',
            description: 'Create a .claudeignore file in your project root. Add: node_modules, dist, .git, build',
            estimatedSavingsPercent: 15,
        });
    }
    // Check for redundant reads
    if (redundantReads.length > 0) {
        const top = redundantReads[0];
        const fileName = top.file.split('/').pop() || top.file;
        actions.push({
            priority: 2,
            title: `Cache repeated reads of ${fileName}`,
            description: `This file was read ${top.count} times. Use session context or ask to summarize instead of re-reading.`,
            estimatedSavingsPercent: Math.min(Math.ceil(top.count * 3), 12),
        });
    }
    // Check for token sinks
    if (tokenSinks.length > 0) {
        actions.push({
            priority: 3,
            title: 'Add build artifacts to .claudeignore',
            description: `Large command outputs detected. Add build/ or dist/ to .claudeignore to avoid scanning generated files.`,
            estimatedSavingsPercent: 8,
        });
    }
    // Check CLAUDE.md size
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
// Need fs at top-level for findSessionFilesInDir
import * as fs from 'fs';
program.parse();
