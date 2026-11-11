// すべてのパラメータ（DESIGN.md 14章）。値は仮。コードに数値を直書きせず、ここから読む。

export type Params = {
  dayStartHour: number;
  sortInstantMs: number;
  sortRevealMs: number;
  spotCheckRate: number;
  spotCheckMinAccuracy: number;
  blockSize: number;
  activeCap: number;
  roundFraction: number;
  graduateStreak: number;
  rescueRounds: number;
  requestRetention: number;
  srsDailyCap: number;
  slowAnswerMs: number;
  stageThresholdsDays: readonly [number, number, number];
  auxiliaryRate: number;
  matureDays: number;
  productiveDays: number;
  leechLapses: number;
  leechWarnRate: number;
  confusionThreshold: number;
  miniSetSize: number;
  defaultBudgetMin: number;
  examCapWeeks: number;
  examSweepWeeks: number;
  examSweepTarget: number;
  paceWarnWeeks: number;
  cycleProbCorrect: number;
  cycleProbWrong: number;
  fallbackSecPerItem: { sort: number; cycle: number; choice4: number; flash: number; input: number };
  /** 検索結果に一度に出す件数 */
  searchResultLimit: number;
};

export const defaultParams: Params = {
  dayStartHour: 4,
  sortInstantMs: 3000,
  sortRevealMs: 5000,
  spotCheckRate: 0.1,
  spotCheckMinAccuracy: 0.8,
  blockSize: 100,
  activeCap: 400,
  roundFraction: 1 / 3,
  graduateStreak: 2,
  rescueRounds: 5,
  requestRetention: 0.9,
  srsDailyCap: 150,
  slowAnswerMs: 8000,
  stageThresholdsDays: [3, 10, 30],
  auxiliaryRate: 0.2,
  matureDays: 21,
  productiveDays: 30,
  leechLapses: 4,
  leechWarnRate: 0.05,
  confusionThreshold: 2,
  miniSetSize: 20,
  defaultBudgetMin: 15,
  examCapWeeks: 6,
  examSweepWeeks: 4,
  examSweepTarget: 0.85,
  paceWarnWeeks: 8,
  cycleProbCorrect: 0.6,
  cycleProbWrong: 0.2,
  fallbackSecPerItem: { sort: 3, cycle: 5, choice4: 6, flash: 7, input: 12 },
  searchResultLimit: 50,
};
