import { describe, expect, test } from 'vitest';
import { formatTime } from './time';

describe('formatTime', () => {
  test.each([
    [0, '0s'],
    [59, '59s'],
    [60, '1.0 min'],
    [90, '1.5 min'],
    [3600, '1.0 hrs'],
    [86400, '1.0 days'],
    [86400 * 3, '3.0 days'],
    [86400 * 7, '1.0 wks'],
    [86400 * 30, '1.0 mos'],
    [86400 * 364, '1.0 yrs'],
  ])('%i seconds -> %s', (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });
});
