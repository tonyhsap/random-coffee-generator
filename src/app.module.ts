import { Module } from '@nestjs/common';
import { GenerateCommand } from './commands/generate.command';
import { UndoCommand } from './commands/undo.command';
import { MarkCommand } from './commands/mark.command';
import { ParticipantsService } from './services/participants.service';
import { HistoryService } from './services/history.service';
import { PairingService } from './services/pairing.service';
import { OutputService } from './services/output.service';

@Module({
  providers: [
    GenerateCommand,
    UndoCommand,
    MarkCommand,
    ParticipantsService,
    HistoryService,
    PairingService,
    OutputService,
  ],
})
export class AppModule {}
