import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { History, Round } from '../interfaces/types';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  loadHistory(filePath?: string): History {
    const resolvedPath = filePath ?? path.join(process.cwd(), 'history.json');

    if (!fs.existsSync(resolvedPath)) {
      this.logger.log('No history.json found, starting fresh');
      return { rounds: [] };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const parsed = JSON.parse(content) as History;

    if (!parsed.rounds || !Array.isArray(parsed.rounds)) {
      return { rounds: [] };
    }

    this.logger.log(`Loaded history with ${parsed.rounds.length} rounds`);
    return parsed;
  }

  saveHistory(history: History, filePath?: string): void {
    const resolvedPath = filePath ?? path.join(process.cwd(), 'history.json');
    fs.writeFileSync(resolvedPath, JSON.stringify(history, null, 2) + '\n', 'utf-8');
    this.logger.log('History saved');
  }

  getUsedPairs(history: History): Set<string> {
    const used = new Set<string>();
    for (const round of history.rounds) {
      for (const pairing of round.pairings) {
        used.add(this.canonicalizePair(pairing.pair[0], pairing.pair[1]));
      }
    }
    return used;
  }

  getUsedPairsForCurrentParticipants(history: History, participantNames: string[]): Set<string> {
    const nameSet = new Set(participantNames);
    const used = new Set<string>();
    for (const round of history.rounds) {
      for (const pairing of round.pairings) {
        if (nameSet.has(pairing.pair[0]) && nameSet.has(pairing.pair[1])) {
          used.add(this.canonicalizePair(pairing.pair[0], pairing.pair[1]));
        }
      }
    }
    return used;
  }

  getSitOutCounts(history: History): Map<string, number> {
    const counts = new Map<string, number>();
    for (const round of history.rounds) {
      if (round.sitOut) {
        counts.set(round.sitOut, (counts.get(round.sitOut) ?? 0) + 1);
      }
    }
    return counts;
  }

  getLastSitOutRound(history: History): Map<string, number> {
    const lastRound = new Map<string, number>();
    for (const round of history.rounds) {
      if (round.sitOut) {
        lastRound.set(round.sitOut, round.round);
      }
    }
    return lastRound;
  }

  shouldReset(participantNames: string[], history: History): boolean {
    const totalPossiblePairs = (participantNames.length * (participantNames.length - 1)) / 2;
    const usedPairs = this.getUsedPairsForCurrentParticipants(history, participantNames);
    return usedPairs.size >= totalPossiblePairs;
  }

  resetHistory(history: History): History {
    this.logger.warn('All possible pairs exhausted — resetting history');
    return { rounds: [] };
  }

  isTooSoon(history: History, targetDate: string, minDaysGap: number = 13): boolean {
    if (history.rounds.length === 0) return false;
    const lastRound = history.rounds[history.rounds.length - 1];
    const lastDate = new Date(lastRound.date);
    const target = new Date(targetDate);
    const diffMs = target.getTime() - lastDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays < minDaysGap;
  }

  getNextRoundNumber(history: History): number {
    if (history.rounds.length === 0) return 1;
    return history.rounds[history.rounds.length - 1].round + 1;
  }

  addRound(history: History, round: Round): History {
    return {
      rounds: [...history.rounds, round],
    };
  }

  removeLastRound(history: History): { history: History; removed: Round | null } {
    if (history.rounds.length === 0) {
      return { history, removed: null };
    }
    const removed = history.rounds[history.rounds.length - 1];
    return {
      history: { rounds: history.rounds.slice(0, -1) },
      removed,
    };
  }

  markPairingCompleted(history: History, roundNumber: number, pairIndex: number): History {
    const roundIdx = history.rounds.findIndex((r) => r.round === roundNumber);
    if (roundIdx === -1) {
      throw new Error(`Round ${roundNumber} not found`);
    }

    const round = history.rounds[roundIdx];
    const zeroIdx = pairIndex - 1;
    if (zeroIdx < 0 || zeroIdx >= round.pairings.length) {
      throw new Error(`Pair index ${pairIndex} out of range (1-${round.pairings.length})`);
    }

    const updatedPairing = {
      ...round.pairings[zeroIdx],
      completed: !round.pairings[zeroIdx].completed,
    };

    const updatedPairings = [...round.pairings];
    updatedPairings[zeroIdx] = updatedPairing;

    const updatedRound = { ...round, pairings: updatedPairings };
    const updatedRounds = [...history.rounds];
    updatedRounds[roundIdx] = updatedRound;

    return { rounds: updatedRounds };
  }

  canonicalizePair(a: string, b: string): string {
    return [a, b].sort().join('|');
  }
}
