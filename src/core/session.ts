import fs from 'fs-extra';
import path from 'path';
import { SessionData, SessionRecord } from '../types/index.js';

export class SessionManager {
  private sessionsDir: string;
  private activeFile: string;

  constructor(cwd: string = process.cwd()) {
    this.sessionsDir = path.join(cwd, '.duo', 'sessions');
    this.activeFile = path.join(cwd, '.duo', 'active_session');
  }

  async init(): Promise<void> {
    await fs.ensureDir(this.sessionsDir);
  }

  async getActiveSession(): Promise<SessionData> {
    await this.init();
    if (await fs.pathExists(this.activeFile)) {
      const activeId = (await fs.readFile(this.activeFile, 'utf-8')).trim();
      const sessionFile = path.join(this.sessionsDir, `${activeId}.json`);
      if (await fs.pathExists(sessionFile)) {
        try {
          return await fs.readJson(sessionFile);
        } catch {
          // fallback to create
        }
      }
    }
    return await this.createSession('default');
  }

  async createSession(title: string = 'default'): Promise<SessionData> {
    await this.init();
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 20)
      .replace(/^-|-$/g, '') || 'session';

    const id = `${timestamp}-${slug}`;
    const now = new Date().toISOString();

    const session: SessionData = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      records: [],
    };

    await this.saveSession(session);
    await this.setActiveId(id);
    return session;
  }

  async listSessions(): Promise<SessionData[]> {
    await this.init();
    const files = await fs.readdir(this.sessionsDir);
    const sessions: SessionData[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = await fs.readJson(path.join(this.sessionsDir, file));
        sessions.push(data);
      } catch {
        // Skip corrupted files
      }
    }

    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async switchSession(id: string): Promise<SessionData> {
    await this.init();
    const sessionFile = path.join(this.sessionsDir, `${id}.json`);
    if (!(await fs.pathExists(sessionFile))) {
      // Try finding by partial ID or title
      const all = await this.listSessions();
      const matched = all.find((s) => s.id.includes(id) || s.title.toLowerCase().includes(id.toLowerCase()));
      if (matched) {
        await this.setActiveId(matched.id);
        return matched;
      }
      throw new Error(`Session not found with ID or title: "${id}"`);
    }

    const session: SessionData = await fs.readJson(sessionFile);
    await this.setActiveId(id);
    return session;
  }

  async saveSession(session: SessionData): Promise<void> {
    await this.init();
    session.updatedAt = new Date().toISOString();
    const sessionFile = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.writeJson(sessionFile, session, { spaces: 2 });
  }

  async recordTask(
    session: SessionData,
    taskId: string,
    goal: string,
    modifiedFiles: string[],
    findings?: string
  ): Promise<void> {
    const record: SessionRecord = {
      taskId,
      goal,
      completedAt: new Date().toISOString(),
      modifiedFiles,
      findings,
    };
    session.records.push(record);
    await this.saveSession(session);
  }

  async deleteSession(id: string): Promise<boolean> {
    await this.init();
    const sessionFile = path.join(this.sessionsDir, `${id}.json`);
    if (await fs.pathExists(sessionFile)) {
      await fs.remove(sessionFile);
      // If deleted session was active, reset active file
      if (await fs.pathExists(this.activeFile)) {
        const activeId = (await fs.readFile(this.activeFile, 'utf-8')).trim();
        if (activeId === id) {
          await fs.remove(this.activeFile);
        }
      }
      return true;
    }
    return false;
  }

  private async setActiveId(id: string): Promise<void> {
    await fs.writeFile(this.activeFile, id, 'utf-8');
  }

  async getActiveId(): Promise<string | null> {
    if (await fs.pathExists(this.activeFile)) {
      return (await fs.readFile(this.activeFile, 'utf-8')).trim();
    }
    return null;
  }
}
