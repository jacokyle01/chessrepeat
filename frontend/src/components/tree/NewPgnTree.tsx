// TODO: comments:
// import { renderInlineCommentsOf, renderComment } from './common';
// import Move from './Move';
// import Inline from './Inline';
// import Children from './Children';
import { useTrainerStore } from '../../state/state';
import { type ChildNode, Game, parsePgn, type PgnNodeData, startingPosition } from 'chessops/pgn';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import { makeUci, Position } from 'chessops';

import { build as makeTree, path as treePath, ops as treeOps, type TreeWrapper } from './tree';


import React from 'react';
import { nimzo } from '../../debug/pgns';
// import { isEmpty } from 'common';
// import { path as treePath, ops as treeOps } from 'tree';
// import * as moveView from '../view/moveView';
// import { nodeClasses, renderingCtx } from './common';
// export interface Ctx {
//   truncateComments: boolean;
// currentPath: Tree.Path | undefined;
// }

export interface Opts {
  parentPath: Tree.Path;
  isMainline: boolean;
  depth: number;
  inline?: Tree.Node;
  withIndex?: boolean;
  truncate?: number;
}

export interface Ctx {
  // showComputer: boolean;
  // showGlyphs: boolean;
  // showEval: boolean;
  truncateComments: boolean;
  currentPath: Tree.Path | undefined;
}


// export const renderingCtx = (): Ctx => ({
//   ctrl,
//   currentPath: findCurrentPath(ctrl),
// });

//TODO convert to tree... pgnimport.ts
export function treeReconstruct(parts: Tree.Node[], sidelines?: Tree.Node[][]): Tree.Node {
  const root = parts[0],
    nb = parts.length;
  let node = root;
  root.id = '';
  for (let i = 1; i < nb; i++) {
    const n = parts[i];
    const variations = sidelines ? sidelines[i] : [];
    if (node.children) node.children.unshift(n, ...variations);
    else node.children = [n, ...variations];
    node = n;
  }
  node.children = node.children || [];
  return root;
}


const readNode = (
  node: ChildNode<PgnNodeData>,
  pos: Position,
  ply: number,
  withChildren = true,
): Tree.Node => {
  const move = parseSan(pos, node.data.san);
  if (!move) throw new Error(`Can't play ${node.data.san} at move ${Math.ceil(ply / 2)}, ply ${ply}`);
  return {
    id: '', //TODO
    ply,
    san: makeSanAndPlay(pos, move),
    fen: makeFen(pos.toSetup()),
    // uci: makeUci(move),
    children: withChildren ? node.children.map((child) => readNode(child, pos.clone(), ply + 1)) : [],
    // check: pos.isCheck() ? makeSquare(pos.toSetup().board.kingOf(pos.turn)!) : undefined,
  };
};

const convertToTree = (root: Game<PgnNodeData>): TreeWrapper => {
  const headers = new Map(Array.from(root.headers, ([key, value]) => [key.toLowerCase(), value]));
  const start = startingPosition(root.headers).unwrap();
  const fen = makeFen(start.toSetup());
  const initialPly = (start.toSetup().fullmoves - 1) * 2 + (start.turn === 'white' ? 0 : 1);
  const treeParts: Tree.Node[] = [
    {
      id: '',
      ply: initialPly,
      fen,
      children: [],
    },
  ];
  let tree = root.moves;
  const pos = start;
  const sidelines: Tree.Node[][] = [[]];
  let index = 0;
  while (tree.children.length) {
    const [mainline, ...variations] = tree.children;
    const ply = initialPly + index + 1;
    sidelines.push(variations.map((variation) => readNode(variation, pos.clone(), ply)));
    treeParts.push(readNode(mainline, pos, ply, false));
    tree = mainline;
    index += 1;
  }
  console.log("treeparts", treeParts);
  console.log("sidelines", sidelines);
  const newTree = makeTree(treeReconstruct(treeParts, sidelines));
  return newTree;
};

//

//

//

// const commentTags = renderMainlineCommentsOf(ctx, root, false, false, '');

//   function renderInlineCommentsOf(ctx: Ctx, node: Tree.Node, path: string): MaybeVNodes {
//   // if (!ctx.ctrl.showComments || isEmpty(node.comments)) return []; //TODO
//   return node
//     .comments!.map(comment => renderComment(comment, node.comments!, 'comment', ctx, path, 300))
//     .filter(nonEmpty);
// }

function EmptyMove() {
  return <div className="empty">...</div>;
}

function RenderMove({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  // const path = opts.parentPath + node.id; // TODO paths
  // const classes = nodeClasses(ctx, node);
  const classes = "";
  return <div className={classes}>{node.ply}</div>;
}

function RenderVariationMove({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  const path = opts.parentPath + node.id;
  const withIndex = opts.withIndex || node.ply % 2 === 1;
  const content = (
    <>
      {withIndex && node.ply}
      {node.san}
    </>
  );
  // const classes = nodeClasses(ctx, node, path);
  return <div>{content}</div>;
}

function RenderMoveOf({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  return opts.isMainline ? (
    <RenderMove ctx={ctx} node={node} opts={opts} />
  ) : (
    <RenderVariationMove ctx={ctx} node={node} opts={opts} />
  );
}

function RenderInline({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  return (
    <div>
      <RenderMoveAndChildren
        ctx={ctx}
        node={node}
        opts={{
          ...opts,
          withIndex: true,
          isMainline: false,
        }}
      />
    </div>
  );
}

function RenderMoveAndChildren({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  const path = opts.parentPath + node.id;
  if (opts.truncate === 0)
    return (
      <div>
        <span>[...]</span>
      </div>
    );

  return (
    <>
      <RenderMoveOf ctx={ctx} node={node} opts={opts} />
      {opts.inline && <RenderInline ctx={ctx} node={opts.inline} opts={opts} />}
      <RenderChildren
        ctx={ctx}
        node={node}
        opts={{
          parentPath: path,
          isMainline: opts.isMainline,
          depth: opts.depth,
          // noConceal: opts.noConceal,
          truncate: opts.truncate ? opts.truncate - 1 : undefined,
        }}
      />
    </>
  );
}

function RenderInlined({ ctx, nodes, opts }: { ctx: Ctx; nodes: Tree.Node[]; opts: Opts }) {
  if (!nodes[1] || nodes[2]) return null;
  if (treeOps.hasBranching(nodes[1], 6)) return null;
  return (
    <RenderMoveAndChildren
      ctx={ctx}
      node={nodes[0]}
      opts={{ ...opts, isMainline: false, inline: nodes[1] }}
    />
  );
}

function RenderLines({
  ctx,
  parentNode,
  nodes,
  opts,
}: {
  ctx: Ctx;
  parentNode: Tree.Node;
  nodes: Tree.Node[];
  opts: Opts;
}) {
  const collapsed =
    parentNode.collapsed === undefined ? opts.depth >= 2 && opts.depth % 2 === 0 : parentNode.collapsed;
  if (collapsed) {
    return (
      <div className="collapsed">
        <div className="expand">
          <div />
          <a
            data-icon="plus"
            title="Expand Variations"
            // onClick={() => ctx.ctrl.setCollapsed(opts.parentPath, false)}
          ></a>
        </div>
      </div>
    );
  }
  return (
    <div className={!nodes[1] ? 'single' : undefined}>
      {nodes.map((n) => (
        <div>
          <div />
          <RenderMoveAndChildren
            ctx={ctx}
            node={n}
            opts={{
              parentPath: opts.parentPath,
              isMainline: false,
              depth: opts.depth + 1,
              withIndex: true,
              // noConceal: opts.noConceal,
              // truncate: n.comp && !treePath.contains(ctx.ctrl.path, opts.parentPath + n.id) ? 3 : undefined,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function RenderChildren({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  console.log("node", node);
  const cs = node.children.filter((x) => ctx.showComputer || !x.comp);
  const main = cs[0];
  if (!main) return null;

  if (opts.isMainline) {
    const isWhite = main.ply % 2 === 1;

    if (!cs[1] && !main.forceVariation) {
      return (
        <>
          {isWhite && main.ply}
          <RenderMoveAndChildren
            ctx={ctx}
            node={main}
            opts={{
              parentPath: opts.parentPath,
              isMainline: true,
              depth: opts.depth,
            }}
          />
        </>
      );
    }

    const mainChildren = !main.forceVariation && (
      <RenderChildren
        ctx={ctx}
        node={main}
        opts={{
          parentPath: opts.parentPath + main.id,
          isMainline: true,
          depth: opts.depth,
        }}
      />
    );

    return (
      <>
        {isWhite && main.ply}
        {!main.forceVariation && (
          <RenderMoveOf
            ctx={ctx}
            node={main}
            opts={{
              parentPath: opts.parentPath,
              isMainline: true,
              depth: opts.depth,
            }}
          />
        )}
        {isWhite && !main.forceVariation && <EmptyMove />}
        <div>
          <RenderLines
            ctx={ctx}
            parentNode={node}
            nodes={main.forceVariation ? cs : cs.slice(1)}
            opts={{
              parentPath: opts.parentPath,
              isMainline: !main.forceVariation,
              depth: opts.depth,
              // noConceal: true,
            }}
          />
        </div>
        {isWhite && mainChildren && main.ply}
        {isWhite && mainChildren && <EmptyMove />}
        {mainChildren}
      </>
    );
  }

  if (!cs[1]) {
    return <RenderMoveAndChildren ctx={ctx} node={cs[0]} opts={opts} />;
  }

  //TODO
  // return (
  //   <RenderInlined ctx={ctx} nodes={cs} opts={opts} /> || (
  //     <RenderLines ctx={ctx} parentNode={node} nodes={cs} opts={opts} />
  //   )
  // );
}

export default function NewPgnTree() {
  // const root = ctrl.tree.root;
  // TODO
  // const blackStarts = false;

  // let trainingPath = useTrainerStore.getState().trainingPath;
  // let repertoire = useTrainerStore.getState().repertoire;
  // let repertoireIndex = useTrainerStore.getState().repertoireIndex;

  // const chapter = repertoire[repertoireIndex];
  // const root = convertToTree(chapter.subrep);
  const game = parsePgn(nimzo())
  // const subgame = game[0].moves;
  const tree = convertToTree(game[0]);
  console.log('tree', tree);

  const root = tree.root;

  const ctx: Ctx = {
    currentPath: "",
    truncateComments: false
  };

  const blackStarts = (root.ply & 1) === 1;

  return (
    <div className="tview2 tview2-column">
      {blackStarts && root.ply}
      {blackStarts && <EmptyMove />}
      <RenderChildren ctx={ctx} node={root} opts={{ parentPath: '', isMainline: true, depth: 0 }} />
    </div>
  );
}
