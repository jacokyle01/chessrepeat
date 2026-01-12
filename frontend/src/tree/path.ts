//TODO named exports.. 

import { TrainableNode } from "../training/types";

export const root: string = '';

export const size = (path: string): number => path.length / 2;

export const head = (path: string): string => path.slice(0, 2);

export const tail = (path: string): string => path.slice(2);

export const init = (path: string): string => path.slice(0, -2);

export const last = (path: string): string => path.slice(-2);

export const contains = (p1: string, p2: string): boolean => p1.startsWith(p2);

export function fromNodeList(nodes: TrainableNode[]): string {
  let path = '';
  for (const i in nodes) path += nodes[i].data.id;
  return path;
}

export const isChildOf = (child: string, parent: string): boolean => !!child && child.slice(0, -2) === parent;

export const intersection = (p1: string, p2: string): string => {
  const head1 = head(p1),
    head2 = head(p2);
  return head1 !== '' && head1 === head2 ? head1 + intersection(tail(p1), tail(p2)) : '';
};
