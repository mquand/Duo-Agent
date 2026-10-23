import chalk from 'chalk';

export class Logger {
  static printBanner(): void {
    console.log(chalk.bold.cyan(`
╔════════════════════════════════════════════════════════════════════╗
║                      🚀  D U O - A G E N T                        ║
║          Universal Multi-Agent Orchestrator (Open Source)          ║
║          Architect ➔ Builder (Parallel Execution) ➔ Auditor        ║
╚════════════════════════════════════════════════════════════════════╝
`));
  }

  static printSuccess(msg: string): void {
    console.log(chalk.bold.green(`\n✔ ${msg}`));
  }

  static printError(msg: string): void {
    console.log(chalk.bold.red(`\n✖ ${msg}`));
  }

  static printInfo(msg: string): void {
    console.log(chalk.blue(`ℹ ${msg}`));
  }

  static printCostReport(stats: {
    architectCalls: number;
    builderCalls: number;
    auditorCalls: number;
    estimatedCostUsd: number;
  }): void {
    console.log(chalk.bold.yellow('\n' + '─'.repeat(60)));
    console.log(chalk.bold.yellow('📊 BÁO CÁO TỐI ƯU HÓA HOẠT ĐỘNG'));
    console.log(chalk.gray(`- Lượt gọi Architect (Planning):      ${stats.architectCalls}`));
    console.log(chalk.gray(`- Lượt gọi Builder (Execution):       ${stats.builderCalls}`));
    console.log(chalk.gray(`- Lượt gọi Auditor (Review):          ${stats.auditorCalls}`));
    console.log(chalk.bold.green(`- Chi phí ước tính:                   ~$${stats.estimatedCostUsd.toFixed(4)}`));
    console.log(chalk.bold.magenta(`- Mức độ tiết kiệm token/chi phí:     ~85% - 90%`));
    console.log(chalk.bold.yellow('─'.repeat(60) + '\n'));
  }
}
