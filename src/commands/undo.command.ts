import { Command, CommandRunner } from 'nest-commander';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { HistoryService } from '../services/history.service';
import { OutputService } from '../services/output.service';

@Command({
  name: 'undo',
  description: 'Remove the last generated round and its pairings file',
})
export class UndoCommand extends CommandRunner {
  private readonly logger = new Logger(UndoCommand.name);

  constructor(
    private readonly historyService: HistoryService,
    private readonly outputService: OutputService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const history = this.historyService.loadHistory();
    const { history: updated, removed } = this.historyService.removeLastRound(history);

    if (!removed) {
      this.logger.log('Nothing to undo.');
      return;
    }

    this.historyService.saveHistory(updated);
    this.outputService.writeSitePage(updated);

    const filePath = path.join(process.cwd(), 'pairings', `${removed.date}.md`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    this.logger.log(`Undone round ${removed.round} (${removed.date})`);
  }
}
