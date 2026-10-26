import chalk from 'chalk';
import { ThemeManager } from './theme.js';

export class Logger {
  static printBanner(themeId?: string): void {
    const theme = ThemeManager.getTheme(themeId);
    const [c1, c2, c3, c4, c5, c6] = theme.gradient;

    const l1 = chalk.hex(c1).bold('  ██████╗ ██╗   ██╗ ██████╗       █████╗  ██████╗ ███████╗███╗   ██╗████████╗');
    const l2 = chalk.hex(c2).bold('  ██╔══██╗██║   ██║██╔═══██╗     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝');
    const l3 = chalk.hex('#00C9FF').bold('  ██║  ██║██║   ██║██║   ██║     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ');
    const l4 = chalk.hex('#92FE9D').bold('  ██║  ██║██║   ██║██║   ██║     ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ');
    const l5 = chalk.hex(c5).bold('  ██████╔╝╚██████╔╝╚██████╔╝     ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ');
    const l6 = chalk.hex(c6).bold('  ╚═════╝  ╚═════╝  ╚═════╝      ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ');

    console.log(`\n${l1}\n${l2}\n${l3}\n${l4}\n${l5}\n${l6}`);
    console.log(chalk.gray('  ' + '─'.repeat(74)));
    console.log(
      chalk.hex(theme.accent)('  Multi-Agent Orchestrator') +
      chalk.gray(' | ') +
      chalk.gray('Architect -> Builder -> Auditor\n')
    );
  }

  static printSuccess(msg: string): void {
    console.log(chalk.green(`\n+ ${msg}`));
  }

  static printError(msg: string): void {
    console.log(chalk.red(`\n! ${msg}`));
  }

  static printInfo(msg: string): void {
    console.log(chalk.gray(`- ${msg}`));
  }

  static printCostReport(
    stats: {
      architectCalls: number;
      builderCalls: number;
      auditorCalls: number;
      estimatedCostUsd: number;
    },
    isEn: boolean = false
  ): void {
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.white.bold(isEn ? 'Summary' : 'Tổng kết'));
    console.log(chalk.gray(`- ${isEn ? 'Architect calls (Planning)' : 'Architect (Lập kế hoạch)'}:    ${stats.architectCalls}`));
    console.log(chalk.gray(`- ${isEn ? 'Builder calls (Execution)' : 'Builder (Thực thi code)'}:     ${stats.builderCalls}`));
    console.log(chalk.gray(`- ${isEn ? 'Auditor calls (Review)' : 'Auditor (Tổng duyệt)'}:        ${stats.auditorCalls}`));
    console.log(chalk.green(`- ${isEn ? 'Estimated cost' : 'Chi phí ước tính'}:                ~$${stats.estimatedCostUsd.toFixed(4)} USD`));
    console.log(chalk.gray(`- ${isEn ? 'Estimated savings' : 'Mức tiết kiệm ước tính'}:             ~85% - 90%`));
    console.log(chalk.gray('─'.repeat(60) + '\n'));
  }
}
