import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export interface ActivityEvent {
  id: string;
  type: 'architect' | 'builder' | 'diff' | 'test' | 'auditor' | 'session' | 'cost' | 'info';
  timestamp: string;
  title: string;
  details?: string;
}

export class ActivityLogger {
  private static logFile = path.join(process.cwd(), '.duo', 'activity.log');

  static async log(
    type: ActivityEvent['type'],
    title: string,
    details?: string
  ): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.logFile));
      const event: ActivityEvent = {
        id: Math.random().toString(36).substring(2, 9),
        type,
        timestamp: new Date().toLocaleTimeString(),
        title,
        details,
      };
      await fs.appendFile(this.logFile, JSON.stringify(event) + '\n', 'utf-8');
    } catch {
      // Ignore logging failures
    }
  }

  static async clear(): Promise<void> {
    try {
      if (await fs.pathExists(this.logFile)) {
        await fs.writeFile(this.logFile, '', 'utf-8');
      }
    } catch {
      // Ignore
    }
  }

  static getLogPath(): string {
    return this.logFile;
  }
}

export class ActivityMonitor {
  static async start(): Promise<void> {
    console.clear();
    console.log(chalk.bold.cyan(`
┌────────────────────────────────────────────────────────────────────┐
│                       DUO ACTIVITY MONITOR                         │
│               Live Agent Activity & Code Diff Stream               │
└────────────────────────────────────────────────────────────────────┘
`));
    console.log(chalk.gray('Listening for Duo-Agent activity... (Ctrl+C to exit)\n'));

    const logFile = ActivityLogger.getLogPath();
    await fs.ensureDir(path.dirname(logFile));
    if (!(await fs.pathExists(logFile))) {
      await fs.writeFile(logFile, '', 'utf-8');
    }

    let filePosition = (await fs.stat(logFile)).size;

    const checkInterval = setInterval(async () => {
      try {
        if (!(await fs.pathExists(logFile))) return;
        const stats = await fs.stat(logFile);
        if (stats.size > filePosition) {
          const stream = fs.createReadStream(logFile, {
            start: filePosition,
            end: stats.size,
            encoding: 'utf-8',
          });

          let chunk = '';
          for await (const data of stream) {
            chunk += data;
          }
          filePosition = stats.size;

          const lines = chunk.split('\n').filter((l) => l.trim().length > 0);
          for (const line of lines) {
            try {
              const event: ActivityEvent = JSON.parse(line);
              this.renderEvent(event);
            } catch {
              // Ignore parse error
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }, 150);

    process.on('SIGINT', () => {
      clearInterval(checkInterval);
      console.log(chalk.gray('\nDuo Monitor stopped.'));
      process.exit(0);
    });
  }

  private static renderEvent(event: ActivityEvent): void {
    const time = chalk.gray(`[${event.timestamp}]`);

    switch (event.type) {
      case 'architect':
        console.log(`${time} ${chalk.bold.blue('[ARCHITECT]')} ${chalk.bold.white(event.title)}`);
        break;

      case 'builder':
        console.log(`${time} ${chalk.bold.cyan('[BUILDER]')} ${chalk.white(event.title)}`);
        break;

      case 'diff':
        console.log(`${time} ${chalk.bold.green('[DIFF]')} ${chalk.green(event.title)}`);
        if (event.details) {
          console.log(chalk.gray('─'.repeat(50)));
          console.log(event.details);
          console.log(chalk.gray('─'.repeat(50)));
        }
        break;

      case 'test':
        console.log(`${time} ${chalk.bold.yellow('[TEST]')} ${chalk.yellow(event.title)}`);
        if (event.details) {
          console.log(chalk.gray(`   > ${event.details}`));
        }
        break;

      case 'auditor':
        console.log(`${time} ${chalk.bold.magenta('[AUDITOR]')} ${chalk.magenta(event.title)}`);
        if (event.details) {
          console.log(chalk.gray(`   > ${event.details}`));
        }
        break;

      case 'session':
        console.log(`${time} ${chalk.bold.white('[SESSION]')} ${chalk.white(event.title)}`);
        break;

      case 'cost':
        console.log(`${time} ${chalk.bold.green('[COST]')} ${chalk.green(event.title)}` + (event.details ? chalk.gray(` (${event.details})`) : ''));
        break;

      default:
        console.log(`${time} ${chalk.gray('[-]')} ${event.title}`);
        break;
    }
  }
}
