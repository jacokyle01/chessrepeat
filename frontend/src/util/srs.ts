// srs_forgetting_curve.ts
//TODO seconds instead of ms?
//TODO interface instead, look at types carefully
export type CardState = {
  // Core memory parameters
  stabilityMs: number; // "S": how slowly it decays
  difficulty: number; // 0..1 (higher = harder)

  // Review history (small but useful)
  reps: number;
  lapses: number;

  // Timing
  lastReviewedAt: number | null; // ms since epoch
  dueAt: number; // ms since epoch (next scheduled review)
};

export type SchedulerOptions = {
  desiredRecall: number; // e.g. 0.9 (review when P(recall) hits 0.9)
  minStabilityMs: number; // clamp
  maxStabilityMs: number; // clamp

  // How strongly correct/incorrect updates stability
  baseGrowth: number; // e.g. 2.2  (correct multiplier baseline)
  baseDecay: number; // e.g. 0.35 (incorrect multiplier baseline)

  // Difficulty adaptation
  difficultyStep: number; // e.g. 0.06
  minDifficulty: number; // e.g. 0.05
  maxDifficulty: number; // e.g. 0.95

  // Fuzz: randomize scheduled interval by ±fuzzPct
  fuzzPct: number; // e.g. 0.08 (±8%)
  fuzzEnabled: boolean;

  // Optional: keep "early learning" from jumping too far
  newCardStabilityMs: number; // e.g. 2 hours
};

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

//TODO should be customizable
export const defaultOptions: SchedulerOptions = {
  desiredRecall: 0.9,
  minStabilityMs: 10 * 60 * 1000, // 10 min
  maxStabilityMs: 3650 * DAY, // ~10 years

  baseGrowth: 2.3,
  baseDecay: 0.35,

  difficultyStep: 0.06,
  minDifficulty: 0.05,
  maxDifficulty: 0.95,

  fuzzPct: 0.08,
  fuzzEnabled: true,

  newCardStabilityMs: 7 * DAY,
};

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Exponential forgetting curve:
 *   recallProb = exp(-elapsed / stability)
 */
export function getRecallProb(card: CardState, nowMs: number): number {
  if (card.lastReviewedAt == null) return 0; // unseen -> treat as not known
  const elapsed = Math.max(0, nowMs - card.lastReviewedAt);
  const p = Math.exp(-elapsed / Math.max(1, card.stabilityMs));
  return clamp(p, 0, 1);
}

export function getForgetProb(card: CardState, nowMs: number): number {
  return 1 - getRecallProb(card, nowMs);
}

/**
 * Solve for when recall probability hits the desiredRecall:
 *   desired = exp(-t/S) => t = -S * ln(desired)
 */
export function getDueAt(card: CardState, opts: SchedulerOptions): number {
  const last = card.lastReviewedAt ?? Date.now();
  const desired = clamp(opts.desiredRecall, 1e-6, 1 - 1e-6);
  const t = -card.stabilityMs * Math.log(desired); // ms until due
  return last + t;
}

export function isDue(card: CardState, nowMs: number): boolean {
  return nowMs >= card.dueAt;
}

function applyFuzz(intervalMs: number, opts: SchedulerOptions): number {
  if (!opts.fuzzEnabled || opts.fuzzPct <= 0) return intervalMs;
  const pct = clamp(opts.fuzzPct, 0, 0.5); // don’t go wild
  const r = (Math.random() * 2 - 1) * pct; // [-pct, +pct]
  return Math.max(0, intervalMs * (1 + r));
}

/**
 * Create a new card state (frontend-only).
 */
export function createCard(nowMs = Date.now(), opts: SchedulerOptions = defaultOptions): CardState {
  const stabilityMs = clamp(opts.newCardStabilityMs, opts.minStabilityMs, opts.maxStabilityMs);

  const card: CardState = {
    stabilityMs,
    difficulty: 0.35, // default medium

    reps: 0,
    lapses: 0,

    lastReviewedAt: null,
    dueAt: nowMs, // due immediately until learned once
  };
  return card;
}

/**
 * Update difficulty slightly.
 * - Correct => difficulty down (easier)
 * - Wrong   => difficulty up (harder)
 */
function updateDifficulty(d: number, correct: boolean, opts: SchedulerOptions): number {
  const step = opts.difficultyStep;
  const next = correct ? d - step : d + step;
  return clamp(next, opts.minDifficulty, opts.maxDifficulty);
}

/**
 * Update stability.
 * - Correct: multiply by growth factor (depends on difficulty + reps)
 * - Wrong:   multiply by decay factor (depends on difficulty)
 */
function updateStabilityMs(card: CardState, correct: boolean, opts: SchedulerOptions): number {
  const d = card.difficulty;

  if (correct) {
    // growth > 1. Harder cards grow slower.
    // reps contributes small extra growth.
    const repsBoost = 1 + 0.05 * Math.log1p(card.reps);
    const diffPenalty = 1 - 0.6 * d; // d in [0,1] => penalty in [0.4,1]
    const growth = opts.baseGrowth * repsBoost * diffPenalty;

    const next = card.stabilityMs * clamp(growth, 1.05, 10);
    return clamp(next, opts.minStabilityMs, opts.maxStabilityMs);
  } else {
    // decay < 1. Harder cards decay less harshly (they were hard anyway),
    // but still shrink stability so it comes back sooner.
    const diffRelief = 1 - 0.35 * (1 - d); // easier cards get punished more
    const decay = opts.baseDecay * diffRelief;

    const next = card.stabilityMs * clamp(decay, 0.05, 0.95);
    return clamp(next, opts.minStabilityMs, opts.maxStabilityMs);
  }
}

/**
 * Core: apply a binary review result and reschedule.
 * "remember" = correct, "forget" = incorrect.
 */
export function review(
  card: CardState,
  correct: boolean,
  nowMs = Date.now(),
  opts: SchedulerOptions = defaultOptions,
): CardState {
  // Update stats
  const reps = card.reps + 1;
  const lapses = card.lapses + (correct ? 0 : 1);

  // Update difficulty then stability (order matters slightly)
  const difficulty = updateDifficulty(card.difficulty, correct, opts);
  const updatedForStability: CardState = { ...card, reps, lapses, difficulty };

  const stabilityMs = updateStabilityMs(updatedForStability, correct, opts);

  // Compute next due based on desired recall
  const baseDueAt = (() => {
    const desired = clamp(opts.desiredRecall, 1e-6, 1 - 1e-6);
    const interval = -stabilityMs * Math.log(desired); // ms
    const fuzzed = applyFuzz(interval, opts);
    return nowMs + fuzzed;
  })();

  console.log('BASE,', baseDueAt);

  return {
    ...card,
    reps,
    lapses,
    difficulty,
    stabilityMs,
    lastReviewedAt: nowMs,
    dueAt: Math.trunc(baseDueAt),
  };
}

export function remember(card: CardState, nowMs?: number, opts?: SchedulerOptions) {
  return review(card, true, nowMs ?? Date.now(), opts ?? defaultOptions);
}

export function forget(card: CardState, nowMs?: number, opts?: SchedulerOptions) {
  return review(card, false, nowMs ?? Date.now(), opts ?? defaultOptions);
}
