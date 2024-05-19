import { VNode, h } from 'snabbdom';

//gets a PGN tree DOM node from a PGN string
//e.x. d4 d5 c4 e6
const indexNode = (turn: number) => h('index.bg-gray-200', `${turn + 1}.`);
const moveNode = (san: string) => h('move.flex-1', san);
const rowNode = (elems: VNode[]) => h('div#move-row.flex.gap-1', elems);


//TODO handle comments
export const pgnTree = (pgn: string[]): VNode => {
  const rows: VNode[] = [];
  let elems: VNode[] = [];
  let i = 0;
  while (pgn.length > 0) {
    if (i % 2 == 0) {
      elems.push(indexNode(i / 2));
    }
    elems.push(moveNode(pgn.shift()!));
    i++;
    if (i % 2 == 0) {
      rows.push(rowNode(elems));
      elems = [];
    }
  }
  return h('div#pgn-tree.w-1/5.shadow.appearance-none.border.rounded', rows);
};
