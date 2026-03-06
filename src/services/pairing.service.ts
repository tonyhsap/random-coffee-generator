import { Injectable, Logger } from '@nestjs/common';
import { Pairing, History, PairingResult } from '../interfaces/types';
import { HistoryService } from './history.service';

@Injectable()
export class PairingService {
  private readonly logger = new Logger(PairingService.name);

  constructor(private readonly historyService: HistoryService) {}

  generatePairings(
    participantNames: string[],
    history: History,
    targetDate: string,
  ): PairingResult {
    let resetOccurred = false;

    // Check if all pairs are exhausted
    if (this.historyService.shouldReset(participantNames, history)) {
      history = this.historyService.resetHistory(history);
      resetOccurred = true;
    }

    const usedPairs = this.historyService.getUsedPairsForCurrentParticipants(
      history,
      participantNames,
    );
    const roundNumber = resetOccurred ? 1 : this.historyService.getNextRoundNumber(history);

    // Handle sit-out for odd number of participants
    let sitOut: string | null = null;
    let activeParticipants = [...participantNames];

    if (activeParticipants.length % 2 !== 0) {
      sitOut = this.selectSitOut(participantNames, history);
      activeParticipants = activeParticipants.filter((name) => name !== sitOut);
      this.logger.log(`Odd number of participants — ${sitOut} sits out this round`);
    }

    // Generate available pairs
    const allPairs = this.getAllPossiblePairs(activeParticipants);
    const availablePairs = allPairs.filter(
      ([a, b]) => !usedPairs.has(this.historyService.canonicalizePair(a, b)),
    );

    // Find a matching
    let matching = this.greedyMatch(activeParticipants, availablePairs);

    // If greedy fails, retry with different shuffles
    if (!matching) {
      for (let attempt = 0; attempt < 10; attempt++) {
        matching = this.greedyMatch(activeParticipants, this.shuffle([...availablePairs]));
        if (matching) break;
      }
    }

    // If still no match, try backtracking
    if (!matching) {
      matching = this.backtrackMatch(
        [...activeParticipants],
        new Set(availablePairs.map(([a, b]) => this.historyService.canonicalizePair(a, b))),
      );
    }

    // If backtracking also fails, reset and try with all pairs
    if (!matching) {
      this.logger.warn('No valid matching found — resetting history and retrying');
      resetOccurred = true;
      matching = this.greedyMatch(activeParticipants, allPairs);
    }

    if (!matching) {
      throw new Error('Failed to generate pairings — this should not happen');
    }

    const pairings: Pairing[] = matching.map(([a, b]) => ({ pair: [a, b] }));

    return {
      round: roundNumber,
      date: targetDate,
      pairings,
      sitOut,
      skipped: false,
      resetOccurred,
    };
  }

  private selectSitOut(participantNames: string[], history: History): string {
    const sitOutCounts = this.historyService.getSitOutCounts(history);
    const lastSitOutRound = this.historyService.getLastSitOutRound(history);

    // Sort: fewest sit-outs first, then least recently sat out, then random
    const sorted = [...participantNames].sort((a, b) => {
      const countA = sitOutCounts.get(a) ?? 0;
      const countB = sitOutCounts.get(b) ?? 0;
      if (countA !== countB) return countA - countB;

      const lastA = lastSitOutRound.get(a) ?? 0;
      const lastB = lastSitOutRound.get(b) ?? 0;
      if (lastA !== lastB) return lastA - lastB;

      return Math.random() - 0.5;
    });

    return sorted[0];
  }

  private getAllPossiblePairs(participants: string[]): [string, string][] {
    const pairs: [string, string][] = [];
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        pairs.push([participants[i], participants[j]]);
      }
    }
    return pairs;
  }

  private greedyMatch(
    participants: string[],
    availablePairs: [string, string][],
  ): [string, string][] | null {
    const shuffled = this.shuffle([...availablePairs]);
    const matched = new Set<string>();
    const result: [string, string][] = [];

    for (const [a, b] of shuffled) {
      if (!matched.has(a) && !matched.has(b)) {
        result.push([a, b]);
        matched.add(a);
        matched.add(b);
      }
    }

    // Check if everyone is matched
    const expectedPairs = Math.floor(participants.length / 2);
    return result.length === expectedPairs ? result : null;
  }

  private backtrackMatch(
    unmatched: string[],
    availablePairs: Set<string>,
  ): [string, string][] | null {
    if (unmatched.length === 0) return [];
    if (unmatched.length === 1) return null;

    const first = unmatched[0];
    const rest = unmatched.slice(1);

    // Randomize order for variety
    const shuffledRest = this.shuffle([...rest]);

    for (const partner of shuffledRest) {
      const key = this.historyService.canonicalizePair(first, partner);
      if (availablePairs.has(key)) {
        const remaining = rest.filter((name) => name !== partner);
        const subResult = this.backtrackMatch(remaining, availablePairs);
        if (subResult !== null) {
          return [[first, partner], ...subResult];
        }
      }
    }

    return null;
  }

  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
