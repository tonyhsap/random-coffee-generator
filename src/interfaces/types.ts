export interface Participant {
  name: string;
}

export interface ParticipantsYaml {
  participants: Participant[];
}

export interface Pairing {
  pair: [string, string];
}

export interface Round {
  date: string;
  round: number;
  pairings: Pairing[];
  sitOut?: string;
}

export interface History {
  rounds: Round[];
}

export interface PairingResult {
  round: number;
  date: string;
  pairings: Pairing[];
  sitOut: string | null;
  skipped: boolean;
  resetOccurred: boolean;
}
