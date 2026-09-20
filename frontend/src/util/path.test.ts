import { describe, expect, test } from 'vitest';
import { contains, fromNodeList, head, init, intersection, isChildOf, last, size, tail } from './path';
import { node } from '../test/fixtures';

// Paths are strings of 2-char node ids concatenated: 'aabbcc' is the
// node cc under bb under aa. '' is the root.
describe('path', () => {
  test('size counts 2-char ids', () => {
    expect(size('')).toBe(0);
    expect(size('aa')).toBe(1);
    expect(size('aabbcc')).toBe(3);
  });

  test('head / tail / init / last', () => {
    expect(head('aabbcc')).toBe('aa');
    expect(tail('aabbcc')).toBe('bbcc');
    expect(init('aabbcc')).toBe('aabb');
    expect(last('aabbcc')).toBe('cc');
  });

  test('head / tail / init / last on root and single id', () => {
    expect(head('')).toBe('');
    expect(tail('')).toBe('');
    expect(init('aa')).toBe('');
    expect(last('aa')).toBe('aa');
  });

  test('contains is prefix containment (p1 is inside p2)', () => {
    expect(contains('aabbcc', 'aabb')).toBe(true);
    expect(contains('aabb', 'aabbcc')).toBe(false);
    expect(contains('aabb', '')).toBe(true);
    expect(contains('aabb', 'aabb')).toBe(true);
  });

  test('isChildOf is exactly one level deeper', () => {
    expect(isChildOf('aabb', 'aa')).toBe(true);
    expect(isChildOf('aa', '')).toBe(true);
    expect(isChildOf('aabbcc', 'aa')).toBe(false);
    expect(isChildOf('', '')).toBe(false);
  });

  test('intersection is the longest common prefix of whole ids', () => {
    expect(intersection('aabbcc', 'aabbdd')).toBe('aabb');
    expect(intersection('aabb', 'ccdd')).toBe('');
    expect(intersection('aabb', 'aabb')).toBe('aabb');
    // 'ab' and 'ac' share a char but not an id
    expect(intersection('ab', 'ac')).toBe('');
  });

  test('fromNodeList joins node ids', () => {
    expect(fromNodeList([node('aa'), node('bb'), node('cc')])).toBe('aabbcc');
    expect(fromNodeList([])).toBe('');
  });
});
