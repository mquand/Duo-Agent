/**
 * Duo-Agent Core Library Entry Point
 * 
 * Exposes core multi-agent components, CodeGraph engine, Git Guard,
 * Handoff manager, and Provider integrations for IDE extensions & MCP servers.
 */

// Core Modules
export * from './core/codegraph.js';
export * from './core/git-guard.js';
export * from './core/diff-engine.js';
export * from './core/handoff.js';
export * from './core/inspector.js';
export * from './core/session.js';
export * from './core/worktree.js';
export * from './core/integration.js';
export * from './core/slicer.js';
export * from './core/scheduler.js';
export * from './core/blackboard.js';
export * from './core/monitor.js';
export * from './core/benchmark.js';
export * from './core/history.js';

// Auth & Configuration
export * from './auth/oauth.js';
export * from './config/manager.js';
export * from './config/models.js';

// Detector & Agents
export * from './detector/project.js';
export * from './agents/architect.js';
export * from './agents/builder.js';
export * from './agents/auditor.js';

// Providers & UI
export * from './providers/base.js';
export * from './providers/factory.js';
export * from './providers/google.js';
export * from './providers/anthropic.js';
export * from './providers/openai-compat.js';
export * from './types/index.js';
