import { z } from 'zod';

export const ContentBlockSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  source: z.object({ type: z.string(), path: z.string().optional() }).optional(),
  content: z.string().optional(),
}).passthrough();

export const UsageSchema = z.object({
  total_tokens: z.number().optional(),
  thinking_tokens: z.number().optional(),
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
}).passthrough();

export const SessionMessageSchema = z.object({
  role: z.string().optional(),
  type: z.string().optional(),
  content: z.union([z.string(), z.array(ContentBlockSchema)]).optional(),
  tokens: z.number().optional(),
  thinking_tokens: z.number().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  model: z.string().optional(),
  usage: UsageSchema.optional(),
}).passthrough();

export type SessionMessage = z.infer<typeof SessionMessageSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

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
