import chalk from 'chalk';
import { ThemeManager } from './theme.js';

export class Logger {
  static printBanner(themeId?: string): void {
    const theme = ThemeManager.getTheme(themeId);
    const [c1, c2, c3, c4, c5, c6] = theme.gradient;

    const l1 = chalk.hex(c1).bold('  ██████╗ ██╗   ██╗ ██████╗       █████╗  ██████╗ ███████╗███╗   ██╗████████╗');
    const l2 = chalk.hex(c2).bold('  ██╔══██╗██║   ██║██╔═══██╗     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝');
    const l3 = chalk.hex(c3).bold('  ██║  ██║██║   ██║██║   ██║     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ');
    const l4 = chalk.hex(c4).bold('  ██║  ██║██║   ██║██║   ██║     ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ');
    const l5 = chalk.hex(c5).bold('  ██████╔╝╚██████╔╝╚██████╔╝     ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ');
    const l6 = chalk.hex(c6).bold('  ╚═════╝  ╚═════╝  ╚═════╝      ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ');

    console.log(`\n${l1}\n${l2}\n${l3}\n${l4}\n${l5}\n${l6}`);
    console.log(chalk.gray('  ' + '═'.repeat(74)));
    console.log(
      chalk.hex(theme.accent).bold('   🥪 Sandwich Architecture ') +
      chalk.gray('• ') +
      chalk.hex(c5).bold('🧘 Ponytail Philosophy ') +
      chalk.gray('• ') +
      chalk.hex(c2).bold('⚡ DAG Parallel Engine')
    );
    console.log(
      chalk.gray('      Architect (Reasoning) ➔ Builder (Execution) ➔ Auditor (Quality)\n')
    );
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
