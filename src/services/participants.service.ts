import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Participant, ParticipantsYaml } from '../interfaces/types';

@Injectable()
export class ParticipantsService {
  private readonly logger = new Logger(ParticipantsService.name);

  loadParticipants(filePath?: string): Participant[] {
    const resolvedPath = filePath ?? path.join(process.cwd(), 'participants.yml');

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Participants file not found: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const parsed = yaml.load(content) as ParticipantsYaml;

    if (!parsed?.participants || !Array.isArray(parsed.participants)) {
      throw new Error('Invalid participants.yml: must contain a "participants" array');
    }

    if (parsed.participants.length < 2) {
      throw new Error('Need at least 2 participants to generate pairings');
    }

    const names = new Set<string>();
    for (const p of parsed.participants) {
      if (!p.name || typeof p.name !== 'string') {
        throw new Error('Each participant must have a non-empty "name" field');
      }
      const normalized = p.name.toLowerCase();
      if (names.has(normalized)) {
        throw new Error(`Duplicate participant name: ${p.name}`);
      }
      names.add(normalized);
    }

    this.logger.log(`Loaded ${parsed.participants.length} participants`);
    return parsed.participants;
  }
}
