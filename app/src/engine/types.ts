// エンジンが扱う型（DESIGN.md 12.1）。言語に依存する中身（見出し語・意味など）は持たない。

/** エンジンが必要とする項目の情報だけ。単語帳の中身は data/types.ts の Item。 */
export type EngineItem = {
  id: string;
  kind: 'word' | 'phrase';
  order: number;
  block: number;
};

export type Phase = 'sort' | 'cycle' | 'srs' | 'spot' | 'drill';
export type Format =
  | 'swipe'
  | 'input'
  | 'flash'
  | 'choice4'
  | 'typeEn'
  | 'cloze'
  | 'audio'
  | 'relation'
  | 'phraseType'
  | 'compare';
export type Outcome = 'known' | 'unknown' | 'correct' | 'wrong' | 'shown';

export type ReviewLog = {
  id: string; // ULID
  itemId: string;
  at: number; // epoch ms
  day: string; // 'YYYY-MM-DD'（4時区切り）
  phase: Phase;
  format: Format;
  outcome: Outcome;
  grade?: 1 | 2 | 3 | 4;
  ms: number;
  fsrsEligible: boolean;
  undone: boolean;
  meta?: {
    corrected?: boolean;
    chosenItemId?: string;
    hintUsed?: boolean;
    typo?: boolean;
    formatPromoted?: boolean;
  };
};

export type ItemState = 'new' | 'known' | 'cycle_waiting' | 'cycle_active' | 'srs';
export type SortClass = 'A' | 'B' | 'C';

/** ts-fsrs の Card を保存用にしたもの（ステップ4で中身を決める） */
export type SerializedCard = Record<string, number | string>;

export type CycleProgress = {
  rounds: number;
  streak: number;
  lastCorrectDay?: string;
  lastSeenDay?: string;
  inputShown: boolean;
};

export type Progress = {
  itemId: string;
  state: ItemState;
  sortClass?: SortClass;
  cycle?: CycleProgress;
  card?: SerializedCard;
  formatStage?: number;
  flags: { leech?: boolean; rescued?: boolean; spotCheckPending?: boolean };
  memo?: string;
  confusions: string[];
  updatedAt: number;
};
