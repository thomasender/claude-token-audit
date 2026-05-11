import * as fs from 'fs';
import * as path from 'path';
const COMMON_IGNORE_PATTERNS = [
    'node_modules',
    'dist',
    '.git',
    'build',
    '.next',
    '__pycache__',
    '*.log',
    '.env',
];
const ESSENTIAL_IGNORE = ['node_modules', 'dist', '.git'];
export function auditConfig(projectPath) {
    const issues = [];
    const suggestions = [];
    const claudeMdPath = findFile(projectPath, ['CLAUDE.md', 'claude.md']);
    let claudeMdSize = 0;
    let claudeMdContent = '';
    if (claudeMdPath) {
        try {
            claudeMdContent = fs.readFileSync(claudeMdPath, 'utf-8');
            claudeMdSize = claudeMdContent.split(/\s+/).length; // approximate token count
            if (claudeMdSize > 1000) {
                issues.push(`CLAUDE.md is ${claudeMdSize} tokens — consider splitting into CLAUDE.md + context-specific files`);
                suggestions.push('Split CLAUDE.md into focused files like CLAUDE_CODE.md, ARCHITECTURE.md');
            }
        }
        catch {
            // ignore
        }
    }
    const claudeignorePath = findFile(projectPath, ['.claudeignore', '.claudignore']);
    let claudeignoreEntries = [];
    let claudeignorePresent = false;
    if (claudeignorePath) {
        claudeignorePresent = true;
        try {
            const content = fs.readFileSync(claudeignorePath, 'utf-8');
            claudeignoreEntries = content.split('\n').map(l => l.trim()).filter(Boolean);
            // Check for essential patterns
            const missing = ESSENTIAL_IGNORE.filter(p => !claudeignoreEntries.includes(p));
            if (missing.length > 0) {
                issues.push(`.claudeignore missing essential entries: ${missing.join(', ')}`);
                suggestions.push(`Add ${missing.join(', ')} to .claudeignore to reduce token usage`);
            }
        }
        catch {
            // ignore
        }
    }
    else {
        issues.push('.claudeignore is missing — large directories may be read unnecessarily');
        suggestions.push('Create .claudeignore with node_modules, dist, .git, and build artifacts');
    }
    return {
        claudeMdSize,
        claudeMdPath: claudeMdPath || null,
        claudeignorePresent,
        claudeignoreEntries,
        issues,
        suggestions,
    };
}
function findFile(dir, names) {
    for (const name of names) {
        const full = path.join(dir, name);
        if (fs.existsSync(full))
            return full;
    }
    // Check parent directories up to homedir
    const parent = path.dirname(dir);
    if (parent !== dir) {
        for (const name of names) {
            const full = path.join(parent, name);
            if (fs.existsSync(full))
                return full;
        }
    }
    return null;
}
