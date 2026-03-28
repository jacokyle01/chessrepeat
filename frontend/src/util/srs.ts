import {
  Card,
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type FSRSParameters,
  type FSRS,
} from 'ts-fsrs';

export type { Card, FSRSParameters };
export { Rating, State } from 'ts-fsrs';

export type SrsConfig = Pick<
  FSRSParameters,
  'request_retention' | 'maximum_interval' | 'enable_fuzz' | 'enable_short_term'
>;

export const defaultSrsConfig: SrsConfig = {
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
  enable_short_term: true,
};

let _scheduler: FSRS = fsrs(generatorParameters(defaultSrsConfig));

export function getScheduler(): FSRS {
  return _scheduler;
}

export function updateScheduler(config: SrsConfig): void {
  _scheduler = fsrs(generatorParameters(config));
}

export function createCard(): Card {
  return createEmptyCard();
}

/**
 * Review a card. `correct` maps to Rating.Good, incorrect to Rating.Again.
 * Returns the updated card.
 */
export function reviewCard(card: Card, correct: boolean, now = new Date()): Card {
  const f = getScheduler();
  const scheduling = f.repeat(card, now);
  const rating = correct ? Rating.Good : Rating.Again;
  return scheduling[rating].card;
}
