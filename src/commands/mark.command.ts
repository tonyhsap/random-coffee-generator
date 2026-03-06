import { Command, CommandRunner, Option } from 'nest-commander';
import { Logger } from '@nestjs/common';
import { HistoryService } from '../services/history.service';
import { OutputService } from '../services/output.service';

interface MarkOptions {
  round: number;
  pair: number;
}

@Command({
  name: 'mark',
  description: 'Toggle completion status of a coffee pairing',
})
export class MarkCommand extends CommandRunner {
  private readonly logger = new Logger(MarkCommand.name);

  constructor(
    private readonly historyService: HistoryService,
    private readonly outputService: OutputService,
  ) {
    super();
  }

  async run(params: string[], options: MarkOptions): Promise<void> {
    if (!options.round || !options.pair) {
      this.logger.error('Both --round and --pair are required');
      return;
    }

    const history = this.historyService.loadHistory();
    const updated = this.historyService.markPairingCompleted(
      history,
      options.round,
      options.pair,
    );

    this.historyService.saveHistory(updated);

    // Regenerate the affected round's Markdown file
    const round = updated.rounds.find((r) => r.round === options.round);
    if (round) {
      const markdown = this.outputService.generateMarkdownFromRound(round);
      this.outputService.writeMarkdownFile(markdown, round.date);
    }

    // Regenerate the HTML site
    this.outputService.writeSitePage(updated);

    const round2 = updated.rounds.find((r) => r.round === options.round);
    const pairing = round2?.pairings[options.pair - 1];
    const status = pairing?.completed ? 'completed' : 'not completed';
    this.logger.log(
      `Marked round ${options.round}, pair ${options.pair} as ${status}`,
    );
  }

  @Option({
    flags: '-r, --round <round>',
    description: 'Round number',
  })
  parseRound(val: string): number {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) {
      throw new Error('Round must be a positive integer');
    }
    return n;
  }

  @Option({
    flags: '-p, --pair <pair>',
    description: 'Pair index (1-based)',
  })
  parsePair(val: string): number {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) {
      throw new Error('Pair index must be a positive integer');
    }
    return n;
  }
}
