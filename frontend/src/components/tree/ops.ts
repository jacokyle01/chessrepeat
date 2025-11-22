//TODO performance penalty from passing in root vs storing in class?
import * as treePath from './path';
// import { defined } from 'common';

export { treePath as path };

export function withMainlineChild<T>(node: Tree.Node, f: (node: Tree.Node) => T): T | undefined {
  const next = node.children[0];
  return next ? f(next) : undefined;
}

export function findInMainline(
  fromNode: Tree.Node,
  predicate: (node: Tree.Node) => boolean,
): Tree.Node | undefined {
  const findFrom = function (node: Tree.Node): Tree.Node | undefined {
    if (predicate(node)) return node;
    return withMainlineChild(node, findFrom);
  };
  return findFrom(fromNode);
}

// returns a list of nodes collected from the original one
export function collect(from: Tree.Node, pickChild: (node: Tree.Node) => Tree.Node | undefined): Tree.Node[] {
  const nodes = [from];
  let n = from,
    c;
  while ((c = pickChild(n))) {
    nodes.push(c);
    n = c;
  }
  return nodes;
}

const pickFirstChild = (node: Tree.Node): Tree.Node | undefined => node.children[0];

export const childById = (node: Tree.Node, id: string): Tree.Node | undefined =>
  node.children.find((child) => child.id === id);

export const last = (nodeList: Tree.Node[]): Tree.Node | undefined => nodeList[nodeList.length - 1];

export const nodeAtPly = (nodeList: Tree.Node[], ply: number): Tree.Node | undefined =>
  nodeList.find((node) => node.ply === ply);

export function takePathWhile(nodeList: Tree.Node[], predicate: (node: Tree.Node) => boolean): Tree.Path {
  let path = '';
  for (const i in nodeList) {
    if (predicate(nodeList[i])) path += nodeList[i].id;
    else break;
  }
  return path;
}

export function removeChild(parent: Tree.Node, id: string): void {
  parent.children = parent.children.filter(function (n) {
    return n.id !== id;
  });
}

export function countChildrenAndComments(node: Tree.Node): {
  nodes: number;
  comments: number;
} {
  const count = {
    nodes: 1,
    comments: node.comment ? 1 : 0,
  };
  node.children.forEach(function (child) {
    const c = countChildrenAndComments(child);
    count.nodes += c.nodes;
    count.comments += c.comments;
  });
  return count;
}

// adds n2 into n1
//TODO can we use for import PGN? :D
// export function merge(n1: Tree.Node, n2: Tree.Node): void {
//   if (n2.eval) n1.eval = n2.eval;
//   if (n2.glyphs) n1.glyphs = n2.glyphs;
//   n2.comments &&
//     n2.comments.forEach(function (c) {
//       if (!n1.comments) n1.comments = [c];
//       else if (
//         !n1.comments.some(function (d) {
//           return d.text === c.text;
//         })
//       )
//         n1.comments.push(c);
//     });
//   n2.children.forEach(function (c) {
//     const existing = childById(n1, c.id);
//     if (existing) merge(existing, c);
//     else n1.children.push(c);
//   });
// }

export const hasBranching = (node: Tree.Node, maxDepth: number): boolean => {
  // console.log("has branching?");
  return (
    maxDepth <= 0 || !!node.children[1] || (node.children[0] && hasBranching(node.children[0], maxDepth - 1))
  );
};
export const mainlineNodeList = (from: Tree.Node): Tree.Node[] => collect(from, pickFirstChild);

export function updateAll(root: Tree.Node, f: (node: Tree.Node) => void): void {
  // applies f recursively to all nodes
  function update(node: Tree.Node) {
    f(node);
    node.children.forEach(update);
  }
  update(root);
}

// const lastNode = (): MaybeNode => findInMainline(root, (node: Tree.Node) => !node.children.length);

export const nodeAtPath = (root: Tree.Node, path: Tree.Path): Tree.Node => nodeAtPathFrom(root, path);

function nodeAtPathFrom(node: Tree.Node, path: Tree.Path): Tree.Node {
  if (path === '') return node;
  const child = childById(node, treePath.head(path));
  return child ? nodeAtPathFrom(child, treePath.tail(path)) : node;
}

const nodeAtPathOrNull = (root: Tree.Node, path: Tree.Path): Tree.Node | undefined =>
  nodeAtPathOrNullFrom(root, path);

function nodeAtPathOrNullFrom(node: Tree.Node, path: Tree.Path): Tree.Node | undefined {
  if (path === '') return node;
  const child = childById(node, treePath.head(path));
  return child ? nodeAtPathOrNullFrom(child, treePath.tail(path)) : undefined;
}

function longestValidPathFrom(node: Tree.Node, path: Tree.Path): Tree.Path {
  const id = treePath.head(path);
  const child = childById(node, id);
  return child ? id + longestValidPathFrom(child, treePath.tail(path)) : '';
}

function getCurrentNodesAfterPly(nodeList: Tree.Node[], mainline: Tree.Node[], ply: number): Tree.Node[] {
  const nodes = [];
  for (const i in nodeList) {
    const node = nodeList[i];
    if (node.ply <= ply && mainline[i].id !== node.id) break;
    if (node.ply > ply) nodes.push(node);
  }
  return nodes;
}

const pathIsMainline = (root: Tree.Node, path: Tree.Path): boolean => pathIsMainlineFrom(root, path);

function pathIsMainlineFrom(node: Tree.Node, path: Tree.Path): boolean {
  if (path === '') return true;
  const pathId = treePath.head(path),
    child = node.children[0];
  if (!child || child.id !== pathId) return false;
  return pathIsMainlineFrom(child, treePath.tail(path));
}

const pathExists = (root: Tree.Node, path: Tree.Path): boolean => !!nodeAtPathOrNull(root, path);

const pathIsForcedVariation = (root: Tree.Node, path: Tree.Path): boolean =>
  !!getNodeList(root, path).find((n) => n.forceVariation);

function lastMainlineNodeFrom(node: Tree.Node, path: Tree.Path): Tree.Node {
  if (path === '') return node;
  const pathId = treePath.head(path);
  const child = node.children[0];
  if (!child || child.id !== pathId) return node;
  return lastMainlineNodeFrom(child, treePath.tail(path));
}

export const getNodeList = (root: Tree.Node, path: Tree.Path): Tree.Node[] =>
  collect(root, function (node: Tree.Node) {
    const id = treePath.head(path);
    if (id === '') return;
    path = treePath.tail(path);
    return childById(node, id);
  });

export function updateAt(
  root: Tree.Node,
  path: Tree.Path,
  update: (node: Tree.Node) => void,
): Tree.Node | undefined {
  console.log('path', path);
  const node = nodeAtPathOrNull(root, path);
  if (node) {
    update(node);
    return node;
  }
  return;
}

function updateRecursive(root: Tree.Node, path: Tree.Path, update: (node: Tree.Node) => void): void {
  const node = nodeAtPathOrNull(root, path);
  if (node) {
    updateAll(node, update);
  }
}

// returns new path
function addNode(root: Tree.Node, node: Tree.Node, path: Tree.Path): Tree.Path | undefined {
  const newPath = path + node.id,
    existing = nodeAtPathOrNull(root, newPath);
  if (existing) {
    (['dests', 'drops', 'clock'] as Array<keyof Tree.Node>).forEach((key) => {
      // if (defined(node[key]) && !defined(existing[key])) existing[key] = node[key] as never;
      existing[key] = node[key] as never;
    });
    return newPath;
  }
  return updateAt(root, path, function (parent: Tree.Node) {
    parent.children.push(node);
  })
    ? newPath
    : undefined;
}

function addNodes(root: Tree.Node, nodes: Tree.Node[], path: Tree.Path): Tree.Path | undefined {
  const node = nodes[0];
  if (!node) return path;
  const newPath = addNode(root, node, path);
  return newPath ? addNodes(root, nodes.slice(1), newPath) : undefined;
}

export function deleteNodeAt(root: Tree.Node, path: Tree.Path): void {
  removeChild(parentNode(root, path), treePath.last(path));
}

function promoteAt(root: Tree.Node, path: Tree.Path, toMainline: boolean): void {
  const nodes = getNodeList(root, path);
  for (let i = nodes.length - 2; i >= 0; i--) {
    const node = nodes[i + 1];
    const parent = nodes[i];
    if (parent.children[0].id !== node.id) {
      removeChild(parent, node.id);
      parent.children.unshift(node);
      if (!toMainline) break;
    } else if (node.forceVariation) {
      node.forceVariation = false;
      if (!toMainline) break;
    }
  }
}
// TODO: just make delete a local function? i.e., handle everything in setCommentAt?
export const setCommentAt = (root: Tree.Node, comment: string, path: Tree.Path) =>
  !comment.length
    ? deleteCommentAt(root, path)
    : updateAt(root, path, function (node) {
      node.comment = comment;
        // node.comments = node.comments || [];
        // const existing = node.comments.find(function (c) {
        //   return c.id === comment.id;
        // });
        // if (existing) existing.text = comment.text;
        // else node.comments.push(comment);
      });

const deleteCommentAt = (root: Tree.Node, path: Tree.Path) =>
  updateAt(root, path, function (node) {
    node.comment = null;
  });

const parentNode = (root: Tree.Node, path: Tree.Path): Tree.Node => nodeAtPath(root, treePath.init(path));
