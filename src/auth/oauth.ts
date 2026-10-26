import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface OAuthTokens {
  googleToken?: string;
  anthropicToken?: string;
  updatedAt?: string;
  source?: string;
}

export interface AnthropicCredentials {
  apiKey?: string;
  baseURL?: string;
  source: 'env' | 'claude_settings' | 'manual' | 'none';
}

export interface AuthStatusReport {
  google: {
    authenticated: boolean;
    authType: 'api_key' | 'oauth_g2auth' | 'jetski_gemini' | 'gcloud_adc' | 'none';
    details: string;
  };
  anthropic: {
    authenticated: boolean;
    authType: 'api_key' | 'claude_settings' | 'oauth_token' | 'none';
    details: string;
  };
  openaiCompatible: {
    configured: boolean;
    details: string;
  };
}

export class AuthManager {
  private static getOAuthStorePath(): string {
    return path.join(os.homedir(), '.duo', 'oauth.json');
  }

  /**
   * Load stored OAuth tokens from ~/.duo/oauth.json
   */
  static loadStoredTokens(): OAuthTokens {
    const storePath = this.getOAuthStorePath();
    if (fs.existsSync(storePath)) {
      try {
        return fs.readJsonSync(storePath);
      } catch {
        return {};
      }
    }
    return {};
  }

  /**
   * Save OAuth tokens into ~/.duo/oauth.json
   */
  static async saveOAuthToken(
    provider: 'google' | 'anthropic',
    token: string,
    source = 'manual'
  ): Promise<void> {
    const storePath = this.getOAuthStorePath();
    await fs.ensureDir(path.dirname(storePath));
    const tokens = this.loadStoredTokens();

    if (provider === 'google') {
      tokens.googleToken = token;
    } else if (provider === 'anthropic') {
      tokens.anthropicToken = token;
    }
    tokens.updatedAt = new Date().toISOString();
    tokens.source = source;

    await fs.writeJson(storePath, tokens, { spaces: 2 });
  }

  /**
   * Resolve Google OAuth / g2auth token:
   * 1. Environment variables (G2AUTH_TOKEN, GOOGLE_OAUTH_TOKEN, etc.)
   * 2. Antigravity / Gemini jetski token (~/.gemini/jetski-standalone-oauth-token)
   * 3. Antigravity / Gemini creds (~/.gemini/oauth_creds.json)
   * 4. Stored token in ~/.duo/oauth.json
   * 5. gcloud application_default_credentials.json
   */
  static getGoogleOAuthToken(): string | null {
    // 1. Environment variables
    const envToken =
      process.env.G2AUTH_TOKEN ||
      process.env.GOOGLE_OAUTH_TOKEN ||
      process.env.GEMINI_OAUTH_TOKEN ||
      process.env.CLOUDSDK_AUTH_ACCESS_TOKEN;
    if (envToken && envToken.trim().length > 0) {
      return envToken.trim();
    }

    // 2. Antigravity / Gemini session: jetski-standalone-oauth-token
    const jetskiPath = path.join(os.homedir(), '.gemini', 'jetski-standalone-oauth-token');
    if (fs.existsSync(jetskiPath)) {
      try {
        const data = fs.readJsonSync(jetskiPath);
        if (data.token?.access_token) {
          return data.token.access_token;
        }
      } catch {
        // Ignore read errors
      }
    }

    // 3. Antigravity / Gemini session: oauth_creds.json
    const geminiCredsPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
    if (fs.existsSync(geminiCredsPath)) {
      try {
        const data = fs.readJsonSync(geminiCredsPath);
        if (data.access_token) {
          return data.access_token;
        }
      } catch {
        // Ignore read errors
      }
    }

    // 4. Stored ~/.duo/oauth.json
    const stored = this.loadStoredTokens();
    if (stored.googleToken && stored.googleToken.trim().length > 0) {
      return stored.googleToken.trim();
    }

    // 5. gcloud application default credentials
    const adcPath = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(adcPath)) {
      try {
        const adc = fs.readJsonSync(adcPath);
        if (adc.access_token) return adc.access_token;
      } catch {
        // Ignore read errors
      }
    }

    return null;
  }

  /**
   * Resolve Anthropic credentials:
   * 1. Environment variables (ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL)
   * 2. Claude Code settings (~/.claude/settings.json)
   * 3. Stored tokens in ~/.duo/oauth.json
   */
  static getAnthropicCredentials(): AnthropicCredentials {
    // 1. Environment variables
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0) {
      return {
        apiKey: process.env.ANTHROPIC_API_KEY.trim(),
        baseURL: process.env.ANTHROPIC_BASE_URL?.trim(),
        source: 'env',
      };
    }

    // 2. Claude settings ~/.claude/settings.json
    const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(claudeSettingsPath)) {
      try {
        const data = fs.readJsonSync(claudeSettingsPath);
        if (data.env?.ANTHROPIC_API_KEY) {
          return {
            apiKey: data.env.ANTHROPIC_API_KEY,
            baseURL: data.env.ANTHROPIC_BASE_URL || undefined,
            source: 'claude_settings',
          };
        }
      } catch {
        // Ignore read errors
      }
    }

    // 3. Stored in ~/.duo/oauth.json
    const stored = this.loadStoredTokens();
    if (stored.anthropicToken && stored.anthropicToken.trim().length > 0) {
      return {
        apiKey: stored.anthropicToken.trim(),
        source: 'manual',
      };
    }

    return { source: 'none' };
  }

  /**
   * Check whether Google is authenticated (API Key OR OAuth/g2auth/Gemini session)
   */
  static hasAgyCli(): boolean {
    return fs.existsSync(path.join(os.homedir(), ".gemini", "bin", "agy"));
  }

  static isGoogleAuthenticated(apiKey?: string): boolean {
    if (apiKey && apiKey.trim().length > 0 && apiKey !== 'not-needed-for-local') {
      return true;
    }
    const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (envKey && envKey.trim().length > 0) {
      return true;
    }
    if (this.hasAgyCli()) {
      return true;
    }
    return !!this.getGoogleOAuthToken();
  }

  /**
   * Check whether Anthropic is authenticated (API Key OR Claude settings OR OAuth)
   */
  static isAnthropicAuthenticated(apiKey?: string): boolean {
    if (apiKey && apiKey.trim().length > 0 && apiKey !== 'not-needed-for-local') {
      return true;
    }
    const creds = this.getAnthropicCredentials();
    return creds.source !== 'none';
  }

  /**
   * Generate comprehensive authentication status report
   */
  static getAuthStatusReport(): AuthStatusReport {
    const googleApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const googleOAuth = this.getGoogleOAuthToken();

    let googleAuthType: AuthStatusReport['google']['authType'] = 'none';
    let googleDetails = 'Not authenticated (needs GEMINI_API_KEY or g2auth/Google OAuth)';

    if (googleApiKey) {
      googleAuthType = 'api_key';
      googleDetails = 'API Key configured (' + googleApiKey.substring(0, 6) + '...)';
    } else if (googleOAuth) {
      const isJetski = fs.existsSync(path.join(os.homedir(), '.gemini', 'jetski-standalone-oauth-token'));
      googleAuthType = isJetski ? 'jetski_gemini' : 'oauth_g2auth';
      googleDetails = isJetski
        ? 'Active Antigravity/Gemini OAuth session (' + googleOAuth.substring(0, 8) + '...)'
        : 'Active OAuth / g2auth token (' + googleOAuth.substring(0, 8) + '...)';
    }

    const anthropicCreds = this.getAnthropicCredentials();
    let anthropicAuthType: AuthStatusReport['anthropic']['authType'] = 'none';
    let anthropicDetails = 'Not authenticated (needs ANTHROPIC_API_KEY or Claude login)';

    if (anthropicCreds.source === 'env') {
      anthropicAuthType = 'api_key';
      anthropicDetails = 'API Key from env (' + (anthropicCreds.apiKey || '').substring(0, 6) + '...)';
    } else if (anthropicCreds.source === 'claude_settings') {
      anthropicAuthType = 'claude_settings';
      anthropicDetails = 'Active Claude session from ~/.claude/settings.json' + (anthropicCreds.baseURL ? ' (' + anthropicCreds.baseURL + ')' : '');
    } else if (anthropicCreds.source === 'manual') {
      anthropicAuthType = 'oauth_token';
      anthropicDetails = 'Active OAuth token (' + (anthropicCreds.apiKey || '').substring(0, 8) + '...)';
    }

    const openAiApiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GROQ_API_KEY;

    return {
      google: {
        authenticated: googleAuthType !== 'none',
        authType: googleAuthType,
        details: googleDetails,
      },
      anthropic: {
        authenticated: anthropicAuthType !== 'none',
        authType: anthropicAuthType,
        details: anthropicDetails,
      },
      openaiCompatible: {
        configured: !!openAiApiKey,
        details: openAiApiKey ? 'API Key configured' : 'Local Ollama supported without key',
      },
    };
  }
}
