import chalk from 'chalk';
export function printBanner() {
    console.log(chalk.cyanBright.bold(`
╔══════════════════════════════════════════════════════╗
║     Claude Context Optics — Token Audit Report      ║
╚══════════════════════════════════════════════════════╝
`));
}
export function printEfficiencyScore(result) {
    const grade = result.efficiencyGrade;
    const gradeColor = getGradeColor(grade);
    console.log(chalk.bold('\n  Efficiency Score:'), gradeColor.bold(`${grade}  (${result.efficiencyScore})`));
    console.log(chalk.gray('  ──────────────────────────────────────────'));
}
export function printSummary(result) {
    console.log(chalk.bold('\n  Summary'));
    console.log(chalk.gray('  ──────────────────────────────────────────'));
    console.log(`  Sessions analyzed     : ${chalk.cyan(result.totalSessionsAnalyzed)}`);
    console.log(`  Total tokens used     : ${chalk.cyan(result.totalTokensUsed.toLocaleString())}`);
    console.log(`  Estimated savings     : ${chalk.green(`~${result.estimatedSavingsPercent}%`)}`);
}
export function printTopActions(actions) {
    console.log(chalk.bold('\n  Top 3 Action Items'));
    console.log(chalk.gray('  ──────────────────────────────────────────'));
    for (const action of actions.slice(0, 3)) {
        const icon = action.priority === 1 ? '🔴' : action.priority === 2 ? '🟡' : '🔵';
        console.log(`\n  ${icon} ${chalk.bold(action.title)}`);
        console.log(`     ${action.description}`);
        console.log(`     ${chalk.green(`~${action.estimatedSavingsPercent}% savings`)}`);
    }
}
export function printRedundantReads(reads) {
    if (reads.length === 0) {
        console.log(chalk.green('\n  ✅ No redundant file reads detected'));
        return;
    }
    console.log(chalk.bold('\n  Redundant Reads (same file read multiple times)'));
    console.log(chalk.gray('  ──────────────────────────────────────────'));
    for (const read of reads.slice(0, 5)) {
        const fileName = read.file.split('/').pop() || read.file;
        const savedTokens = Math.min(read.estimatedTokens, 5000);
        console.log(`  📄 ${chalk.yellow(fileName)} — read ${read.count}× ${chalk.gray(`(~${savedTokens} tokens saved by caching)`)}`);
    }
}
export function printTokenSinks(sinks) {
    if (sinks.length === 0) {
        console.log(chalk.green('\n  ✅ No large bash outputs detected'));
        return;
    }
    console.log(chalk.bold('\n  Token Sinks (large command outputs)'));
    console.log(chalk.gray('  ──────────────────────────────────────────'));
    for (const sink of sinks.slice(0, 3)) {
        console.log(`  ⚠️  ${chalk.cyan(sink.command.length > 60 ? sink.command.substring(0, 60) + '...' : sink.command)}`);
        console.log(`     ${chalk.gray('→')} ${sink.suggestion}`);
    }
}
export function printReasoningFlags(flags) {
    if (flags.length === 0) {
        console.log(chalk.green('\n  ✅ Reasoning efficiency looks good'));
        return;
    }
    console.log(chalk.bold('\n  Reasoning Flags (thinking > 20% of tokens on simple tasks)'));
    console.log(chalk.gray('  ──────────────────────────────────────────'));
    for (const flag of flags.slice(0, 3)) {
        console.log(`  🔶 ${chalk.yellow(flag.session)} — ${flag.thinkingPercent}% thinking tokens (${flag.totalTokens.toLocaleString()} total)`);
    }
}
export function printConfigAudit(config) {
    console.log(chalk.bold('\n  Config Audit'));
    console.log(chalk.gray('  ──────────────────────────────────────────'));
    console.log(`  CLAUDE.md         : ${config.claudeMdPath ? chalk.green('found') : chalk.red('missing')} ${config.claudeMdSize > 0 ? `(${config.claudeMdSize} tokens)` : ''}`);
    console.log(`  .claudeignore     : ${config.claudeignorePresent ? chalk.green('found') : chalk.red('missing')}`);
    if (config.claudeignoreEntries.length > 0) {
        console.log(`  Ignore patterns   : ${chalk.gray(config.claudeignoreEntries.slice(0, 5).join(', '))}${config.claudeignoreEntries.length > 5 ? '...' : ''}`);
    }
    if (config.issues.length > 0) {
        console.log(chalk.bold('\n  Config Issues:'));
        for (const issue of config.issues) {
            console.log(`  ⚠️  ${issue}`);
        }
    }
}
export function printNoDataFound() {
    console.log(chalk.yellow('\n  No session data found. Make sure Claude Code has been used and'));
    console.log(chalk.yellow('  session logs are stored in ~/.claude/projects/'));
    console.log(chalk.gray('\n  Tip: Run some tasks with Claude Code first, then re-run this audit.'));
}
export function printFooter() {
    console.log(chalk.cyanBright.bold('\n  Run again after making changes to track improvement.\n'));
}
function getGradeColor(grade) {
    switch (grade) {
        case 'A': return chalk.green;
        case 'B': return chalk.greenBright;
        case 'C': return chalk.yellow;
        case 'D': return chalk.hex('#FF8C00');
        case 'F': return chalk.red;
        default: return chalk.gray;
    }
}
