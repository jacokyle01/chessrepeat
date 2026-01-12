// TODO should these be in store?

import { TrainableNode } from '../training/types';
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

// //TODO performance penalty from passing in root vs storing in class?
// import * as treePath from './path';
// // import { defined } from 'common';

// export { treePath as path };

// export function withMainlineChild<T>(node: TrainableNode, f: (node: TrainableNode) => T): T | undefined {
//   const next = node.children[0];
//   return next ? f(next) : undefined;
// }

// export function findInMainline(
//   fromNode: TrainableNode,
//   predicate: (node: TrainableNode) => boolean,
// ): TrainableNode | undefined {
//   const findFrom = function (node: TrainableNode): TrainableNode | undefined {
//     if (predicate(node)) return node;
//     return withMainlineChild(node, findFrom);
//   };
//   return findFrom(fromNode);
// }

// // returns a list of nodes collected from the original one
// export function collect(from: TrainableNode, pickChild: (node: TrainableNode) => TrainableNode | undefined): TrainableNode[] {
//   const nodes = [from];
//   let n = from,
//     c;
//   while ((c = pickChild(n))) {
//     nodes.push(c);
//     n = c;
//   }
//   return nodes;
// }

// const pickFirstChild = (node: TrainableNode): TrainableNode | undefined => node.children[0];

// export const childById = (node: TrainableNode, id: string): TrainableNode | undefined =>
//   node.children.find((child) => child.id === id);

// export const last = (nodeList: TrainableNode[]): TrainableNode | undefined => nodeList[nodeList.length - 1];

// export const nodeAtPly = (nodeList: TrainableNode[], ply: number): TrainableNode | undefined =>
//   nodeList.find((node) => node.ply === ply);

// export function takePathWhile(nodeList: TrainableNode[], predicate: (node: TrainableNode) => boolean): string {
//   let path = '';
//   for (const i in nodeList) {
//     if (predicate(nodeList[i])) path += nodeList[i].id;
//     else break;
//   }
//   return path;
// }

export function removeChild(parent: TrainableNode, id: string): void {
  parent.children = parent.children.filter(function (n) {
    return n.data.id !== id;
  });
}

// export function countChildrenAndComments(node: TrainableNode): {
//   nodes: number;
//   comments: number;
// } {
//   const count = {
//     nodes: 1,
//     comments: node.comment ? 1 : 0,
//   };
//   node.children.forEach(function (child) {
//     const c = countChildrenAndComments(child);
//     count.nodes += c.nodes;
//     count.comments += c.comments;
//   });
//   return count;
// }

// // adds n2 into n1
// //TODO can we use for import PGN? :D
// // export function merge(n1: TrainableNode, n2: TrainableNode): void {
// //   if (n2.eval) n1.eval = n2.eval;
// //   if (n2.glyphs) n1.glyphs = n2.glyphs;
// //   n2.comments &&
// //     n2.comments.forEach(function (c) {
// //       if (!n1.comments) n1.comments = [c];
// //       else if (
// //         !n1.comments.some(function (d) {
// //           return d.text === c.text;
// //         })
// //       )
// //         n1.comments.push(c);
// //     });
// //   n2.children.forEach(function (c) {
// //     const existing = childById(n1, c.id);
// //     if (existing) merge(existing, c);
// //     else n1.children.push(c);
// //   });
// // }

// export const hasBranching = (node: TrainableNode, maxDepth: number): boolean => {
//   // console.log("has branching?");
//   return (
//     maxDepth <= 0 || !!node.children[1] || (node.children[0] && hasBranching(node.children[0], maxDepth - 1))
//   );
// };
// export const mainlineNodeList = (from: TrainableNode): TrainableNode[] => collect(from, pickFirstChild);

// // const lastNode = (): MaybeNode => findInMainline(root, (node: TrainableNode) => !node.children.length);

// function longestValidPathFrom(node: TrainableNode, path: string): string {
//   const id = treePath.head(path);
//   const child = childById(node, id);
//   return child ? id + longestValidPathFrom(child, treePath.tail(path)) : '';
// }

// function getCurrentNodesAfterPly(nodeList: TrainableNode[], mainline: TrainableNode[], ply: number): TrainableNode[] {
//   const nodes = [];
//   for (const i in nodeList) {
//     const node = nodeList[i];
//     if (node.ply <= ply && mainline[i].id !== node.id) break;
//     if (node.ply > ply) nodes.push(node);
//   }
//   return nodes;
// }

// const pathIsMainline = (root: TrainableNode, path: string): boolean => pathIsMainlineFrom(root, path);

// function pathIsMainlineFrom(node: TrainableNode, path: string): boolean {
//   if (path === '') return true;
//   const pathId = treePath.head(path),
//     child = node.children[0];
//   if (!child || child.id !== pathId) return false;
//   return pathIsMainlineFrom(child, treePath.tail(path));
// }

// const pathExists = (root: TrainableNode, path: string): boolean => !!nodeAtPathOrNull(root, path);

// const pathIsForcedVariation = (root: TrainableNode, path: string): boolean =>
//   !!getNodeList(root, path).find((n) => n.forceVariation);

// function lastMainlineNodeFrom(node: TrainableNode, path: string): TrainableNode {
//   if (path === '') return node;
//   const pathId = treePath.head(path);
//   const child = node.children[0];
//   if (!child || child.id !== pathId) return node;
//   return lastMainlineNodeFrom(child, treePath.tail(path));
// }

// export const getNodeList = (root: TrainableNode, path: string): TrainableNode[] =>
//   collect(root, function (node: TrainableNode) {
//     const id = treePath.head(path);
//     if (id === '') return;
//     path = treePath.tail(path);
//     return childById(node, id);
//   });

// export function updateAt(
//   root: TrainableNode,
//   path: string,
//   update: (node: TrainableNode) => void,
// ): TrainableNode | undefined {
//   console.log('path', path);
//   const node = nodeAtPathOrNull(root, path);
//   if (node) {
//     update(node);
//     return node;
//   }
//   return;
// }

// // returns new path
// function addNode(root: TrainableNode, node: TrainableNode, path: string): string | undefined {
//   const newPath = path + node.id,
//     existing = nodeAtPathOrNull(root, newPath);
//   if (existing) {
//     (['dests', 'drops', 'clock'] as Array<keyof TrainableNode>).forEach((key) => {
//       // if (defined(node[key]) && !defined(existing[key])) existing[key] = node[key] as never;
//       existing[key] = node[key] as never;
//     });
//     return newPath;
//   }
//   return updateAt(root, path, function (parent: TrainableNode) {
//     parent.children.push(node);
//   })
//     ? newPath
//     : undefined;
// }

// function addNodes(root: TrainableNode, nodes: TrainableNode[], path: string): string | undefined {
//   const node = nodes[0];
//   if (!node) return path;
//   const newPath = addNode(root, node, path);
//   return newPath ? addNodes(root, nodes.slice(1), newPath) : undefined;
// }

export function deleteNodeAt(root: TrainableNode, path: string): void {
  removeChild(parentNode(root, path), last(path));
}

// function promoteAt(root: TrainableNode, path: string, toMainline: boolean): void {
//   const nodes = getNodeList(root, path);
//   for (let i = nodes.length - 2; i >= 0; i--) {
//     const node = nodes[i + 1];
//     const parent = nodes[i];
//     if (parent.children[0].id !== node.id) {
//       removeChild(parent, node.id);
//       parent.children.unshift(node);
//       if (!toMainline) break;
//     } else if (node.forceVariation) {
//       node.forceVariation = false;
//       if (!toMainline) break;
//     }
//   }
// }
// // TODO: just make delete a local function? i.e., handle everything in setCommentAt?
// export const setCommentAt = (root: TrainableNode, comment: string, path: string) =>
//   !comment.length
//     ? deleteCommentAt(root, path)
//     : updateAt(root, path, function (node) {
//       node.comment = comment;
//         // node.comments = node.comments || [];
//         // const existing = node.comments.find(function (c) {
//         //   return c.id === comment.id;
//         // });
//         // if (existing) existing.text = comment.text;
//         // else node.comments.push(comment);
//       });

// const deleteCommentAt = (root: TrainableNode, path: string) =>
//   updateAt(root, path, function (node) {
//     node.comment = null;
//   });

const parentNode = (root: TrainableNode, path: string): TrainableNode =>
  nodeAtPath(root, init(path));
