
// TODO: comments:
import { useTrainerStore } from '../../state/state';
import { type ChildNode, defaultHeaders, Game, parsePgn, type PgnNodeData, startingPosition } from 'chessops/pgn';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import { makeUci, Position } from 'chessops';

import { build as makeTree, path as treePath, ops as treeOps, type TreeWrapper } from './tree';

import React from 'react';
import { foolsMate, nimzo } from '../../debug/pgns';
import { PlusIcon } from 'lucide-react';
export interface Opts {
  parentPath: Tree.Path;
  isMainline: boolean;
  depth: number;
  inline?: Tree.Node;
  withIndex?: boolean;
  truncate?: number;
}

export interface Ctx {
  truncateComments: boolean;
  currentPath: Tree.Path | undefined;
}


//TODO
// export const renderIndexText = (ply: Ply, withDots?: boolean): string =>
//   plyToTurn(ply) + (withDots ? (ply % 2 === 1 ? '.' : '...') : '');

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
  // const headers = new Map(Array.from(root.headers, ([key, value]) => [key.toLowerCase(), value]));
  const start = startingPosition(defaultHeaders()).unwrap();
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
  console.log("root in CtT", root);
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
  console.log('treeparts', treeParts);
  console.log('sidelines', sidelines);
  const newTree = makeTree(treeReconstruct(treeParts, sidelines));
  return newTree;
};

//TODO maybe dont style this as if it was a real move?
function EmptyMove() {
  return (
    <div className="empty move items-center self-start flex shadow-md basis-[43.5%] shrink-0 grow-0 leading-[27.65px] px-[7.9px] pr-[4.74px] text-[#4d4d4d] overflow-hidden font-bold text-red-400">
      ...
    </div>
  );
}

function IndexNode(ply: number) {
  return (
    <div className="index flex items-center self-start basis-[13%] justify-center border-r border-[#d9d9d9] bg-[#f9f9f9] text-[#999]">
      {ply}
    </div>
  );
}

function RenderMainlineMove({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  // const path = opts.parentPath + node.id; // TODO paths
  // const classes = nodeClasses(ctx, node);
  const classes = '';
  return (
    <div className="move items-center self-start flex shadow-md basis-[43.5%] shrink-0 grow-0 leading-[27.65px] px-[7.9px] pr-[4.74px] text-[#4d4d4d] overflow-hidden font-bold text-red-400">
      {node.san}
    </div>
  );
}

function RenderVariationMove({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  const path = opts.parentPath + node.id;
  const withIndex = opts.withIndex || node.ply % 2 === 1;
  const content = (
    <>
      {withIndex && `${Math.floor(node.ply / 2) + 1}. `}
      {node.san}
    </>
  );
  // const classes = nodeClasses(ctx, node, path);
  return (
    <span className="move variation text-[15.8px] px-[7.9px] pr-[4.74px] overflow-hidden">{content}</span>
  );
}

type RenderMainlineMoveOfProps = {
  ctx: Ctx;
  node: Tree.Node;
  opts: Opts;
};

function RenderMoveOf({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  return opts.isMainline ? (
    <RenderMainlineMove ctx={ctx} node={node} opts={opts} />
  ) : (
    <RenderVariationMove ctx={ctx} node={node} opts={opts} />
  );
}

function RenderInline({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  return (
    <div className="inline italic">
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
      opts={{ parentPath: opts.parentPath, isMainline: false, depth: opts.depth, inline: nodes[1] }}
    />
  );
}

export function RenderLines({ ctx, parentNode, nodes, opts }) {
  const collapsed =
    parentNode.collapsed === undefined ? opts.depth >= 2 && opts.depth % 2 === 0 : parentNode.collapsed;
  console.log('render lines w/ parent', parentNode.san);
  if (collapsed) {
    return (
      <div className={`lines single ${collapsed ? 'collapsed' : ''}`}>
        <line className="expand">
          <div className="branch" />
          {/* <a
            data-icon={licon.PlusButton}
            title={i18n.site.expandVariations}
            onClick={() => ctx.ctrl.setCollapsed(opts.parentPath, false)}
          /> */}
          <PlusIcon></PlusIcon>
        </line>
      </div>
    );
  }

  return (
    <div className={`lines ${!nodes[1] ? 'single' : ''} ${collapsed ? 'collapsed' : ''}`}>
      {nodes.map((n) => {
        // const retro = retroLine(ctx, n);
        // if (retro) return retro;

        const truncate = n.comp && !treePath.contains(ctx.ctrl.path, opts.parentPath + n.id) ? 3 : undefined;

        return (
          <div className="line block relative ps-[7px]" key={n.id}>
            <div className="branch" />
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
        );
      })}
    </div>
  );
}

function RenderChildren({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  // console.log('node', node);
  const cs = node.children.filter((x) => ctx.showComputer || !x.comp);
  const main = cs[0];
  if (!main) return null;

  if (opts.isMainline) {
    const isWhite = main.ply % 2 === 1;

    //TODO why is this different than lichess ?  math.floor(..) line
    if (!cs[1] && !main.forceVariation) {
      return (
        <>
          {isWhite && IndexNode(Math.floor(main.ply / 2) + 1)}
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
        {isWhite && IndexNode(Math.floor(main.ply / 2) + 1)}
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
        <div className="interrupt flex-[0_0_100%] max-w-full bg-zebra border-t border-b border-border">
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
        {isWhite && mainChildren && IndexNode(Math.floor(main.ply / 2) + 1)}
        {isWhite && mainChildren && <EmptyMove />}
        {mainChildren}
      </>
    );
  }

  if (!cs[1]) {
    return <RenderMoveAndChildren ctx={ctx} node={cs[0]} opts={opts} />;
  }

  const nodes = cs;
  let shouldRenderLines = !nodes[1] || nodes[2] || treeOps.hasBranching(nodes[1], 6);
  console.log('in render children');
  if (shouldRenderLines) {
    return (
      <>
        <RenderLines ctx={ctx} parentNode={node} nodes={cs} opts={opts} />
      </>
    );
  }
  // TODO - fix infinite render loop, figure out if we need renderInlined
  // TODO - we just need a way to ensure that the whole PGN is viewable
  // return <RenderInlined ctx={ctx} nodes={cs} opts={opts} />;
}

export default function NewPgnTree() {
  // const game = parsePgn(nimzo());
  // const tree = convertToTree(game[0]);
  // console.log('tree', tree);

  // const root = tree.root;

    const repertoire = useTrainerStore.getState().repertoire;
    const repertoireIndex = useTrainerStore.getState().repertoireIndex;
    // const pathIndex = useTrainerStore.getState().pathIndex;
    // const pathIndex = useTrainerStore.getState().pathIndex;

    
    
    // TODO conditionally use path or root, depending on context  


    // TODO ???
    if (!repertoire[repertoireIndex]) return;
    const game = repertoire[repertoireIndex].subrep;
    console.log("game", game);
    // TODO handle multiple root nodes, possibly upon PGN import... (dont allow chapter w/ multiple roots)
    const tree = convertToTree(game);
    const root = tree.root;
  


  const ctx: Ctx = {
    currentPath: '',
    truncateComments: false,
  };


  const blackStarts = (root.ply & 1) === 1;

  return (
    <div className="tview2 tview2-column overflow-y-auto max-h-[1000px] flex flex-row flex-wrap items-start">
      {blackStarts && root.ply}
      {blackStarts && <EmptyMove />}
      <RenderChildren ctx={ctx} node={root} opts={{ parentPath: '', isMainline: true, depth: 0 }} />
    </div>
  );
}
