// TODO: comments:
import { useTrainerStore } from '../../state/state';
import {
  type ChildNode,
  defaultHeaders,
  Game,
  parsePgn,
  type PgnNodeData,
  startingPosition,
} from 'chessops/pgn';
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

//TODO maybe dont style this as if it was a real move?
function EmptyMove() {
  return (
    <div className="empty move items-center self-start flex shadow-sm basis-[43.5%] shrink-0 grow-0 leading-[27.65px] px-[7.9px] overflow-hidden font-bold text-gray-600">
      ...
    </div>
  );
}

function IndexNode(ply: number) {
  return (
    <div className="index self-stretch flex items-center self-start basis-[13%] justify-center border-r bg-[#f9f9f9] text-[#999]">
      {ply}
    </div>
  );
}

function RenderMainlineMove({ ctx, node, opts }: { ctx: Ctx; node: Tree.Node; opts: Opts }) {
  const path = opts.parentPath + node.id;
  // const path = opts.parentPath + node.id; // TODO paths
  // const classes = nodeClasses(ctx, node);

  const selectedPath = useTrainerStore.getState().selectedPath;
  const activeClass = path == selectedPath ? 'bg-blue-400/50' : '';
  const classes = '';
  return (
    <div
      data-path={path}
      className={`move items-center self-start flex shadow-sm basis-[43.5%] shrink-0 grow-0 leading-[27.65px] px-[7.9px] pr-[4.74px] overflow-hidden font-bold text-gray-600 ${activeClass}`}
    >
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

  const selectedPath = useTrainerStore.getState().selectedPath;
  const activeClass = path == selectedPath ? 'bg-blue-400/50 rounded-md' : '';

  return (
    <span
      data-path={path}
      className={`move variation text-[15.8px] px-[7.9px] pr-[4.74px] overflow-hidden ${activeClass}`}
    >
      {content}
    </span>
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
  // console.log('render lines w/ parent'
  // , parentNode.san);
  if (collapsed) {
    return (
      <div className={`lines single ${collapsed ? 'collapsed' : ''}`}>
        <div className="expand">
          <div className="branch" />
          {/* <a
            data-icon={licon.PlusButton}
            title={i18n.site.expandVariations}
            onClick={() => ctx.ctrl.setCollapsed(opts.parentPath, false)}
          /> */}
          <PlusIcon></PlusIcon>
        </div>
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
  let repertoire = useTrainerStore.getState().repertoire;
  let repertoireIndex = useTrainerStore.getState().repertoireIndex;
  const chapter = repertoire[repertoireIndex];

  const pathToTrain = useTrainerStore.getState().trainableContext.startingPath;
  const path: Tree.Node[] = chapter.tree.getNodeList(pathToTrain);

  const method = useTrainerStore.getState().repertoireMethod;

  // console.log('node', node);
  const ply = node.ply;
  // console.log('PATH', path);
  // console.log(ply, 'ply', path, 'path');

  /*
  e.x. d4 --> c4 

  trainingNodeList = d4,c4

  d4, ply=1
  c4, ply=3 

  0
: 
{id: '', ply: 1, san: 'd4', fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', disabled: false, …}
1
: 
{id: '', ply: 2, san: 'd5', fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2', disabled: true, …}
2
: 
{id: '', ply: 3, san: 'c4', 

*/

  //TODO, match by ID instead
  // console.log('%%%%%%%%%%%%%%');
  // console.log('%%%%%%%%%%%%%%');
  // console.log('%%%%%%%%%%%%%%');
  // console.log('PARENT', node.san);
  // console.log(
  //   'CHILDREN',
  //   node.children.map((x) => x.san),
  // );
  // console.log('PLY', ply);
  // console.log('path', path);
  // console.log(
  //   'PATH',
  //   path.map((x) => x.san),
  // );
  const cs = node.children.filter((x, i) => {
    // console.log('x.san', x.san, 'vs', path[ply + 1].san);
    return (
      method == 'edit' ||
      (ply < path.length - 1 && x.san == path[ply + 1].san && (ctx.showComputer || !x.comp))
    );
  });
  // console.log('FOUND', cs);
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
  // console.log('in render children');
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

//TODO function should be part of state
export default function NewPgnTree({ jump }) {
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle left click or touch
    if (e.button !== 0) return;

    // Traverse DOM to find the nearest element with a data-path
    let el = e.target as HTMLElement;
    while (el && el !== e.currentTarget) {
      const path = el.getAttribute('data-path');
      if (path) {
        // ctrl.userJump(path); // your navigation logic
        // ctrl.redraw();
        // console.log('PATH', path);
        jump(path);
        break;
      }
      el = el.parentElement!;
    }
  };

  // const game = parsePgn(nimzo());
  // const tree = convertToTree(game[0]);
  // console.log('tree', tree);

  // const root = tree.root;

  const repertoire = useTrainerStore.getState().repertoire;
  const repertoireIndex = useTrainerStore.getState().repertoireIndex;
  const chapter = repertoire[repertoireIndex];
  if (!chapter) return;
  const root = chapter.tree.root;
  // console.log('root path');
  // TODO conditionally use path or root, depending on context

  // TODO ???
  // if (!repertoire[repertoireIndex]) return;
  // const game = repertoire[repertoireIndex].subrep;
  // console.log("game", game);
  // TODO handle multiple root nodes, possibly upon PGN import... (dont allow chapter w/ multiple roots)

  const ctx: Ctx = {
    currentPath: '',
    truncateComments: false,
  };

  const blackStarts = (root.ply & 1) === 1;

  return (
    <div className='h-[400px] bg-white'>
      <div
        onMouseDown={handleMouseDown}
        className="tview2 tview2-column overflow-y-auto max-h-[400px] flex flex-row flex-wrap items-start bg-white"
      >
        {blackStarts && root.ply}
        {blackStarts && <EmptyMove />}
        <RenderChildren ctx={ctx} node={root} opts={{ parentPath: '', isMainline: true, depth: 0 }} />
      </div>
    </div>
  );
}

// el.addEventListener('mousedown', (e: MouseEvent) => {
//   if (defined(e.button) && e.button !== 0) return; // only touch or left click
//   const path = eventPath(e);
//   if (path) ctrl.userJump(path);
//   ctrl.redraw();
// });

// jump(path: Tree.Path): void {
//   const pathChanged = path !== this.path,
//     isForwardStep = pathChanged && path.length === this.path.length + 2;
//   this.setPath(path);
//   if (pathChanged) {
//     if (this.study) this.study.setPath(path, this.node);
//     if (isForwardStep) site.sound.move(this.node);
//     this.threatMode(false);
//     this.ceval?.stop();
//     this.startCeval();
//     site.sound.saySan(this.node.san, true);
//   }
//   this.justPlayed = this.justDropped = this.justCaptured = undefined;
//   this.explorer.setNode();
//   this.updateHref();
//   this.autoScroll();
//   this.promotion.cancel();
//   if (pathChanged) {
//     if (this.retro) this.retro.onJump();
//     if (this.practice) this.practice.onJump();
//     if (this.study) this.study.onJump();
//   }
//   pubsub.emit('ply', this.node.ply, this.tree.lastMainlineNode(this.path).ply === this.node.ply);
//   this.showGround();
//   this.pluginUpdate(this.node.fen);
// }
