import { Command, CommandRunner, Option } from 'nest-commander';
import { Logger } from '@nestjs/common';
import { ParticipantsService } from '../services/participants.service';
import { HistoryService } from '../services/history.service';
import { PairingService } from '../services/pairing.service';
import { OutputService } from '../services/output.service';
import { Round } from '../interfaces/types';

interface GenerateOptions {
  date?: string;
  dryRun?: boolean;
}

@Command({
  name: 'generate',
  description: 'Generate random coffee pairings for the team',
})
export class GenerateCommand extends CommandRunner {
  private readonly logger = new Logger(GenerateCommand.name);

  constructor(
    private readonly participantsService: ParticipantsService,
    private readonly historyService: HistoryService,
    private readonly pairingService: PairingService,
    private readonly outputService: OutputService,
  ) {
    super();
  }

  async run(params: string[], options: GenerateOptions): Promise<void> {
    const targetDate = options.date ?? this.getNextMonday();
    this.logger.log(`Generating pairings for ${targetDate}`);

    // Load participants
    const participants = this.participantsService.loadParticipants();
    const names = participants.map((p) => p.name);

    // Load history
    let history = this.historyService.loadHistory();

    // Check bi-weekly cadence (skip if manual date override)
    if (!options.date && this.historyService.isTooSoon(history, targetDate)) {
      this.logger.log('Skipping — less than 2 weeks since the last round');
      return;
    }

    // Generate pairings
    const result = this.pairingService.generatePairings(names, history, targetDate);

    if (result.skipped) {
      return;
    }

    // Generate Markdown
    const markdown = this.outputService.generateMarkdown(result);

    if (options.dryRun) {
      this.logger.log('--- DRY RUN ---');
      console.log(markdown);
      return;
    }

    // Write output file
    this.outputService.writeMarkdownFile(markdown, targetDate);

    // Update history
    const newRound: Round = {
      date: result.date,
      round: result.round,
      pairings: result.pairings,
      ...(result.sitOut && { sitOut: result.sitOut }),
    };

    if (result.resetOccurred) {
      history = { rounds: [] };
    }
    history = this.historyService.addRound(history, newRound);
    this.historyService.saveHistory(history);
    this.outputService.writeSitePage(history);

    // Summary
    this.logger.log(`✅ Round ${result.round} generated for ${targetDate}`);
    for (const pairing of result.pairings) {
      this.logger.log(`   ☕ ${pairing.pair[0]} & ${pairing.pair[1]}`);
    }
    if (result.sitOut) {
      this.logger.log(`   🪑 Sitting out: ${result.sitOut}`);
    }
  }

  @Option({
    flags: '-d, --date <date>',
    description: 'Override pairing date (YYYY-MM-DD)',
  })
  parseDate(val: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      throw new Error('Date must be in YYYY-MM-DD format');
    }
    return val;
  }

  @Option({
    flags: '--dry-run',
    description: 'Preview pairings without writing files',
  })
  parseDryRun(): boolean {
    return true;
  }

  private getNextMonday(): string {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  }
}
