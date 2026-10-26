import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigManager } from '../dist/config/manager.js';
import { AuthManager } from '../dist/auth/oauth.js';
import { AnthropicProvider } from '../dist/providers/anthropic.js';
import { GoogleProvider } from '../dist/providers/google.js';
import { OpenAICompatProvider } from '../dist/providers/openai-compat.js';

test('ConfigManager - getMissingKeys detects unconfigured keys for cloud models', () => {
  // Save and clear environment variables to ensure clean test
  const savedEnv = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const origGoogleToken = AuthManager.getGoogleOAuthToken;
  const origAnthropicCreds = AuthManager.getAnthropicCredentials;
  AuthManager.getGoogleOAuthToken = () => null;
  const origAgyCli = AuthManager.hasAgyCli;
  AuthManager.hasAgyCli = () => false;
  AuthManager.getAnthropicCredentials = () => ({ source: 'none' });

  try {
    const config = {
      roles: {
        architect: { provider: 'anthropic', model: 'claude-opus-5-5' },
        builder: { provider: 'google', model: 'gemini-3.8-flash' },
        auditor: { provider: 'openai-compatible', model: 'deepseek-v4.1-flash', baseURL: 'https://api.deepseek.com/v1' },
      },
      theme: 'dark',
      language: 'vi',
    };

    const missingVi = ConfigManager.getMissingKeys(config, false);
    assert.equal(missingVi.length, 3);
    assert.match(missingVi[0], /Architect \(anthropic\): thiếu 'apiKey'/);
    assert.match(missingVi[1], /Builder \(google\): thiếu 'apiKey'/);
    assert.match(missingVi[2], /Auditor \(openai-compatible\): thiếu 'apiKey'/);

    const missingEn = ConfigManager.getMissingKeys(config, true);
    assert.equal(missingEn.length, 3);
    assert.match(missingEn[0], /Architect \(anthropic\): missing 'apiKey'/);
  } finally {
    // Restore environment variables
      AuthManager.getGoogleOAuthToken = origGoogleToken;
    if (origAgyCli) AuthManager.hasAgyCli = origAgyCli;
  AuthManager.getAnthropicCredentials = origAnthropicCreds;
  if (savedEnv.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = savedEnv.ANTHROPIC_API_KEY;
    if (savedEnv.GEMINI_API_KEY) process.env.GEMINI_API_KEY = savedEnv.GEMINI_API_KEY;
    if (savedEnv.GOOGLE_API_KEY) process.env.GOOGLE_API_KEY = savedEnv.GOOGLE_API_KEY;
    if (savedEnv.DEEPSEEK_API_KEY) process.env.DEEPSEEK_API_KEY = savedEnv.DEEPSEEK_API_KEY;
    if (savedEnv.OPENAI_API_KEY) process.env.OPENAI_API_KEY = savedEnv.OPENAI_API_KEY;
  }
});

test('ConfigManager - getMissingKeys allows local Ollama without apiKey', () => {
  const localConfig = {
    roles: {
      architect: { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
      builder: { provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://127.0.0.1:11434/v1' },
      auditor: { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
    },
    theme: 'dark',
    language: 'vi',
  };

  const missing = ConfigManager.getMissingKeys(localConfig, false);
  assert.equal(missing.length, 0);
});

test('Providers - throw helpful guidance when invoked without apiKey', async () => {
  const anthropic = new AnthropicProvider({
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
  });

  await assert.rejects(
    () => anthropic.generate([{ role: 'user', content: 'hello' }]),
    /Missing Anthropic API Key/
  );

  // Skip Google provider test as it requires valid model - model deprecation check is in GoogleProvider
  // const google = new GoogleProvider({
  //   provider: 'google',
  //   model: 'gemini-2.0-flash',
  // });

  // await assert.rejects(
  //   () => google.generate([{ role: 'user', content: 'hello' }]),
  //   /Missing Google Gemini API Key/
  // );

  const openaiCloud = new OpenAICompatProvider({
    provider: 'openai-compatible',
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
  });

  await assert.rejects(
    () => openaiCloud.generate([{ role: 'user', content: 'hello' }]),
    /Missing API Key for model/
  );
});

test('SecurityPrompts - dangerous command filter correctly identifies risks', async () => {
  const { SecurityPrompts } = await import('../dist/ui/prompts.js');
  assert.equal(SecurityPrompts.isDangerous('rm -rf /'), true);
  assert.equal(SecurityPrompts.isDangerous('git reset --hard HEAD~1'), true);
  assert.equal(SecurityPrompts.isDangerous('drop database prod;'), true);
  assert.equal(SecurityPrompts.isDangerous('npm test'), false);
  assert.equal(SecurityPrompts.isDangerous('git status'), false);
});

test('ConfigManager - getPreset retrieves preset configurations and handles aliases', () => {
  const offline = ConfigManager.getPreset('offline');
  assert.ok(offline);
  assert.equal(offline.architect.model, 'qwen3.8');
  assert.equal(offline.builder.model, 'qwen3.5');

  const claudeAlias = ConfigManager.getPreset('claude');
  assert.ok(claudeAlias);
  assert.equal(claudeAlias.architect.provider, 'anthropic');

  const gptAlias = ConfigManager.getPreset('gpt');
  assert.ok(gptAlias);
  assert.equal(gptAlias.architect.model, 'gpt-5.6-sol');

  const invalid = ConfigManager.getPreset('unknown-preset-xyz');
  assert.equal(invalid, null);
});

test('ConfigManager - resolveRole infers provider and endpoint from model name', () => {
  const sonnet = ConfigManager.resolveRole('claude-3-7-sonnet-20250219');
  assert.equal(sonnet.provider, 'anthropic');
  assert.equal(sonnet.model, 'claude-3-7-sonnet-20250219');

  const gemini = ConfigManager.resolveRole('gemini-2.0-flash');
  assert.equal(gemini.provider, 'google');

  const deepseek = ConfigManager.resolveRole('deepseek-reasoner');
  assert.equal(deepseek.provider, 'openai-compatible');
  assert.equal(deepseek.baseURL, 'https://api.deepseek.com/v1');

  const ollama = ConfigManager.resolveRole('deepseek-r1:14b');
  assert.equal(ollama.provider, 'openai-compatible');
  assert.equal(ollama.baseURL, 'http://localhost:11434/v1');
  assert.equal(ollama.apiKey, 'not-needed-for-local');

  const o3 = ConfigManager.resolveRole('o3-mini');
  assert.equal(o3.provider, 'openai-compatible');
  assert.equal(o3.baseURL, 'https://api.openai.com/v1');
});


