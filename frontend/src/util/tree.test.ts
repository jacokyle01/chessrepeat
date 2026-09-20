import { describe, expect, test } from 'vitest';
import {
  childById,
  deleteNodeAt,
  forEachNode,
  getNodeList,
  hasBranching,
  nodeAtPath,
  nodeAtPathOrNull,
  removeChild,
  updateAll,
  updateAt,
  updateRecursive,
} from './tree';
import { node, root } from '../test/fixtures';

//        root
//       /    \
//     aa      dd
//    /  \
//  bb    cc
//  |
//  ee
const build = () =>
  root(node('aa', { children: [node('bb', { children: [node('ee')] }), node('cc')] }), node('dd'));

describe('tree lookup', () => {
  test('nodeAtPath walks ids', () => {
    const r = build();
    expect(nodeAtPath(r, '').data.id).toBe('');
    expect(nodeAtPath(r, 'aa').data.id).toBe('aa');
    expect(nodeAtPath(r, 'aabbee').data.id).toBe('ee');
    expect(nodeAtPath(r, 'dd').data.id).toBe('dd');
  });

  test('nodeAtPath stops at the deepest existing node on a bad path', () => {
    // This is load-bearing: the store relies on it for "path drifted
    // from server" detection via nodeAtPathOrNull, but nodeAtPath itself
    // never returns undefined.
    const r = build();
    expect(nodeAtPath(r, 'aazz').data.id).toBe('aa');
    expect(nodeAtPath(r, 'zz').data.id).toBe('');
  });

  test('nodeAtPathOrNull returns undefined on a bad path', () => {
    const r = build();
    expect(nodeAtPathOrNull(r, 'aabbee')?.data.id).toBe('ee');
    expect(nodeAtPathOrNull(r, 'aazz')).toBeUndefined();
    expect(nodeAtPathOrNull(r, 'zz')).toBeUndefined();
  });

  test('childById', () => {
    const r = build();
    expect(childById(r, 'dd')?.data.id).toBe('dd');
    expect(childById(r, 'bb')).toBeUndefined();
  });

  test('getNodeList includes root and every node along the path', () => {
    const r = build();
    expect(getNodeList(r, 'aabbee').map((n) => n.data.id)).toEqual(['', 'aa', 'bb', 'ee']);
    expect(getNodeList(r, '').map((n) => n.data.id)).toEqual(['']);
  });

  test('getNodeList truncates at the first missing id', () => {
    const r = build();
    expect(getNodeList(r, 'aazzee').map((n) => n.data.id)).toEqual(['', 'aa']);
  });
});

describe('tree traversal', () => {
  test('forEachNode is pre-order depth-first', () => {
    const seen: string[] = [];
    forEachNode(build(), (n) => seen.push(n.data.id));
    expect(seen).toEqual(['', 'aa', 'bb', 'ee', 'cc', 'dd']);
  });

  test('updateAll applies to every node including the start', () => {
    const r = build();
    updateAll(nodeAtPath(r, 'aa'), (n) => (n.data.comment = 'x'));
    expect(nodeAtPath(r, 'aabbee').data.comment).toBe('x');
    expect(nodeAtPath(r, 'aacc').data.comment).toBe('x');
    expect(nodeAtPath(r, 'dd').data.comment).toBe('');
  });

  test('updateRecursive targets a subtree by path and ignores bad paths', () => {
    const r = build();
    updateRecursive(r, 'aabb', (n) => (n.data.enabled = false));
    expect(nodeAtPath(r, 'aabb').data.enabled).toBe(false);
    expect(nodeAtPath(r, 'aabbee').data.enabled).toBe(false);
    expect(nodeAtPath(r, 'aacc').data.enabled).toBe(true);

    updateRecursive(r, 'zz', (n) => (n.data.comment = 'nope'));
    forEachNode(r, (n) => expect(n.data.comment).toBe(''));
  });

  test('updateAt returns the touched node or undefined', () => {
    const r = build();
    const hit = updateAt(r, 'aacc', (n) => n.children.push(node('ff')));
    expect(hit?.data.id).toBe('cc');
    expect(nodeAtPath(r, 'aaccff').data.id).toBe('ff');
    expect(updateAt(r, 'aazz', () => {})).toBeUndefined();
  });
});

describe('tree mutation', () => {
  test('deleteNodeAt removes the subtree at path', () => {
    const r = build();
    deleteNodeAt(r, 'aabb');
    expect(nodeAtPathOrNull(r, 'aabb')).toBeUndefined();
    expect(nodeAtPathOrNull(r, 'aabbee')).toBeUndefined();
    expect(nodeAtPath(r, 'aa').children.map((n) => n.data.id)).toEqual(['cc']);
  });

  test('deleteNodeAt of a top-level line', () => {
    const r = build();
    deleteNodeAt(r, 'dd');
    expect(r.children.map((n) => n.data.id)).toEqual(['aa']);
  });

  test('removeChild is a no-op for unknown ids', () => {
    const r = build();
    removeChild(r, 'zz');
    expect(r.children).toHaveLength(2);
  });
});

describe('hasBranching', () => {
  test('finds a fork within depth', () => {
    const r = build();
    // root itself forks (aa, dd) at depth 1
    expect(hasBranching(r, 1)).toBe(true);
    // aa forks (bb, cc)
    expect(hasBranching(nodeAtPath(r, 'aa'), 1)).toBe(true);
    // bb -> ee is a single line
    expect(hasBranching(nodeAtPath(r, 'aabb'), 5)).toBe(false);
  });

  test('depth 0 never branches', () => {
    expect(hasBranching(build(), 0)).toBe(false);
  });

  test('a fork deeper than the limit is not seen', () => {
    // root -> aa -> (bb | cc): the fork is one level below aa.
    const single = root(node('aa', { children: [node('bb'), node('cc')] }));
    expect(hasBranching(single, 1)).toBe(false);
    expect(hasBranching(single, 2)).toBe(true);
  });
});
