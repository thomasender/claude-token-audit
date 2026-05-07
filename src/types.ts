import { z } from 'zod';

export interface SessionMessage {
  role: string;
  content: string | ContentBlock[];
  tokens?: number;
  thinkingTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  type?: string;
}

export interface ContentBlock {
  type: string;
  text?: string;
  source?: { type: string; path?: string };
  content?: string;
}

export interface SessionFile {
  path: string;
  projectPath: string;
  messages: SessionMessage[];
  totalTokens: number;
  totalThinkingTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface RedundantRead {
  file: string;
  count: number;
  estimatedTokens: number;
}

export interface TokenSink {
  command: string;
  estimatedTokens: number;
  suggestion: string;
}

export interface ConfigAudit {
  claudeMdSize: number;
  claudeMdPath: string | null;
  claudeignorePresent: boolean;
  claudeignoreEntries: string[];
  issues: string[];
  suggestions: string[];
}

export interface AuditResult {
  efficiencyScore: string;
  efficiencyGrade: string;
  totalSessionsAnalyzed: number;
  totalTokensUsed: number;
  estimatedSavingsPercent: number;
  topActions: ActionItem[];
  redundantReads: RedundantRead[];
  tokenSinks: TokenSink[];
  reasoningFlags: ReasoningFlag[];
  configAudit: ConfigAudit;
}

export interface ReasoningFlag {
  session: string;
  thinkingPercent: number;
  totalTokens: number;
}

export interface ActionItem {
  priority: number;
  title: string;
  description: string;
  estimatedSavingsPercent: number;
}