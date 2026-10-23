export type ProviderType = 'anthropic' | 'google' | 'openai-compatible';

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'off';

export interface RoleConfig {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  baseURL?: string;
  reasoningEffort?: ReasoningEffort;
}

export interface AppConfig {
  roles: {
    architect: RoleConfig;
    builder: RoleConfig;
    auditor: RoleConfig;
  };
  language?: 'en' | 'vi';
  theme?: string;
  telemetry?: boolean;
}

export interface DAGStep {
  id: string;
  title: string;
  target_files: string[];
  instructions: string;
  depends_on: string[];
  verification_cmd?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  error?: string;
}

export interface Plan {
  goal: string;
  summary: string;
  dag: DAGStep[];
}

export interface DiffBlock {
  file: string;
  searchBlock: string;
  replaceBlock: string;
}

export interface AuditorReviewResult {
  approved: boolean;
  critique: string;
  polishDiffs?: DiffBlock[];
}

export interface ExecutionOptions {
  planOnly?: boolean;
  autoAccept?: boolean;
  dryRun?: boolean;
  concurrency?: number;
  worktree?: boolean;
}

export interface DetectedProject {
  type: string;
  language: string;
  testCommand?: string;
  formatCommand?: string;
  ruleFile?: string;
  ruleContent?: string;
}

export interface SessionRecord {
  taskId: string;
  goal: string;
  completedAt: string;
  modifiedFiles: string[];
  findings?: string;
}

export interface SessionData {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  checkpointRef?: string;
  totalTokens?: number;
  estimatedCostUsd?: number;
  pinnedFiles?: string[];
  summary?: string;
  records: SessionRecord[];
}
