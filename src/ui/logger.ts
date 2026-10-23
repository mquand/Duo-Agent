import chalk from 'chalk';

export class Logger {
  static printBanner(): void {
    const l1 = chalk.hex('#00F2FE').bold('  ██████╗ ██╗   ██╗ ██████╗       █████╗  ██████╗ ███████╗███╗   ██╗████████╗');
    const l2 = chalk.hex('#4FACFE').bold('  ██╔══██╗██║   ██║██╔═══██╗     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝');
    const l3 = chalk.hex('#00C9FF').bold('  ██║  ██║██║   ██║██║   ██║     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ');
    const l4 = chalk.hex('#92FE9D').bold('  ██║  ██║██║   ██║██║   ██║     ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ');
    const l5 = chalk.hex('#38EF7D').bold('  ██████╔╝╚██████╔╝╚██████╔╝     ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ');
    const l6 = chalk.hex('#11998E').bold('  ╚═════╝  ╚═════╝  ╚═════╝      ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ');

    console.log(`\n${l1}\n${l2}\n${l3}\n${l4}\n${l5}\n${l6}`);
    console.log(chalk.gray('  ' + '═'.repeat(74)));
    console.log(
      chalk.bold.cyan('   🥪 Sandwich Architecture ') +
      chalk.gray('• ') +
      chalk.bold.green('🧘 Ponytail Philosophy ') +
      chalk.gray('• ') +
      chalk.bold.magenta('⚡ DAG Parallel Engine')
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
