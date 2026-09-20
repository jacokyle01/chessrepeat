import { afterEach, describe, expect, test } from 'vitest';
import { createCard, defaultSrsConfig, reviewCard, State, updateScheduler } from './srs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-01-01T12:00:00Z');

afterEach(() => updateScheduler(defaultSrsConfig));

describe('srs', () => {
  test('a new card is due immediately and unreviewed', () => {
    const card = createCard();
    expect(card.reps).toBe(0);
    expect(card.state).toBe(State.New);
    expect(card.due.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('a correct first review schedules the card into the future', () => {
    const card = reviewCard(createCard(), true, NOW);
    expect(card.reps).toBe(1);
    expect(card.lapses).toBe(0);
    expect(card.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(card.last_review?.getTime()).toBe(NOW.getTime());
  });

  test('a wrong answer is rescheduled sooner than a right one', () => {
    const good = reviewCard(createCard(), true, NOW);
    const again = reviewCard(createCard(), false, NOW);
    expect(again.due.getTime()).toBeLessThan(good.due.getTime());
  });

  test('successive correct reviews lengthen the interval', () => {
    updateScheduler({ ...defaultSrsConfig, enable_fuzz: false });
    let card = reviewCard(createCard(), true, NOW);
    const first = card.due.getTime() - NOW.getTime();

    const t2 = card.due;
    card = reviewCard(card, true, t2);
    const second = card.due.getTime() - t2.getTime();

    const t3 = card.due;
    card = reviewCard(card, true, t3);
    const third = card.due.getTime() - t3.getTime();

    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(card.reps).toBe(3);
  });

  test('a lapse after reviews shortens the interval and counts', () => {
    updateScheduler({ ...defaultSrsConfig, enable_fuzz: false });
    let card = reviewCard(createCard(), true, NOW);
    for (let i = 0; i < 3; i++) card = reviewCard(card, true, card.due);
    const before = card.scheduled_days;
    const reviewedAt = card.due;
    const lapsed = reviewCard(card, false, reviewedAt);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.scheduled_days).toBeLessThan(before);
    // short-term learning is off in defaultSrsConfig, so the floor is a day
    expect(lapsed.due.getTime() - reviewedAt.getTime()).toBeGreaterThanOrEqual(DAY);
  });

  test('updateScheduler changes scheduling: lower retention -> longer intervals', () => {
    updateScheduler({ ...defaultSrsConfig, enable_fuzz: false, request_retention: 0.9 });
    const strict = reviewCard(createCard(), true, NOW);
    updateScheduler({ ...defaultSrsConfig, enable_fuzz: false, request_retention: 0.7 });
    const lax = reviewCard(createCard(), true, NOW);
    expect(lax.scheduled_days).toBeGreaterThan(strict.scheduled_days);
  });
});
