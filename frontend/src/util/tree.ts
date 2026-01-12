// TODO should these be in store?

import { TrainableNode } from '../types/training';
import { head, init, last, tail } from './path';

export function forEachNode(root: TrainableNode, visit: (node: TrainableNode) => void): void {
  const dfs = (n: TrainableNode) => {
    visit(n);
    for (const c of n.children) dfs(c);
  };
  dfs(root);
}

export const nodeAtPath = (root: TrainableNode, path: string): TrainableNode => nodeAtPathFrom(root, path);

function nodeAtPathFrom(node: TrainableNode, path: string): TrainableNode {
  if (path === '') return node;
  const child = childById(node, head(path));
  return child ? nodeAtPathFrom(child, tail(path)) : node;
}

export const childById = (node: TrainableNode, id: string): TrainableNode | undefined =>
  node.children.find((child) => child.data.id === id);

export const getNodeList = (root: TrainableNode, path: string): TrainableNode[] =>
  collect(root, function (node: TrainableNode) {
    const id = head(path);
    if (id === '') return;
    path = tail(path);
    return childById(node, id);
  });

export function collect(
  from: TrainableNode,
  pickChild: (node: TrainableNode) => TrainableNode | undefined,
): TrainableNode[] {
  const nodes = [from];
  let n = from,
    c;
  while ((c = pickChild(n))) {
    nodes.push(c);
    n = c;
  }
  return nodes;
}

export function updateRecursive(
  root: TrainableNode,
  path: string,
  update: (node: TrainableNode) => void,
): void {
  const node = nodeAtPathOrNull(root, path);
  if (node) {
    updateAll(node, update);
  }
}

const nodeAtPathOrNull = (root: TrainableNode, path: string): TrainableNode | undefined =>
  nodeAtPathOrNullFrom(root, path);

function nodeAtPathOrNullFrom(node: TrainableNode, path: string): TrainableNode | undefined {
  if (path === '') return node;
  const child = childById(node, head(path));
  return child ? nodeAtPathOrNullFrom(child, tail(path)) : undefined;
}

export function updateAll(root: TrainableNode, f: (node: TrainableNode) => void): void {
  // applies f recursively to all nodes
  function update(node: TrainableNode) {
    f(node);
    node.children.forEach(update);
  }
  update(root);
}

export function removeChild(parent: TrainableNode, id: string): void {
  parent.children = parent.children.filter(function (n) {
    return n.data.id !== id;
  });
}

export function deleteNodeAt(root: TrainableNode, path: string): void {
  removeChild(parentNode(root, path), last(path));
}

const parentNode = (root: TrainableNode, path: string): TrainableNode =>
  nodeAtPath(root, init(path));
