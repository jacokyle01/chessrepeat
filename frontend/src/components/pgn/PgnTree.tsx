// TODO: comments:
// TODO use primereact icons instead?
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

import { ContextMenu } from 'primereact/contextmenu';
import { useAppContextMenu } from './ContextMenuProvider';

import { build as makeTree, path as treePath, ops as treeOps, type TreeWrapper } from '../tree/tree';
import { ContextMenuProvider } from './ContextMenuProvider';

import React, { useRef } from 'react';
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

const isEmpty = (a: any | undefined): boolean => !a || a.length === 0;

// COMMENTS

function truncateComment(text: string, len: number, ctx: Ctx) {
  return ctx.truncateComments && text.length > len ? text.slice(0, len - 10) + ' [...]' : text;
}

function commentAuthorText(by?: string) {
  if (!by) return '';
  if (by === 'lichess') return 'lichess';
  return by;
}

function enrichText(text: string): string {
  // Replace with actual formatting logic (links, markdown, etc.)
  return text;
}

// -------------------------
// Components
// -------------------------

function TruncatedComment({ path, ctx, children }: { path: string; ctx: Ctx; children: React.ReactNode }) {
  const handleClick = () => {
    // ctx.ctrl.userJumpIfCan(path);
    // ctx.ctrl.study?.vm.toolTab('comments');
    // ctx.ctrl.redraw();
    // document.querySelector('.analyse__underboard')?.scrollIntoView();
  };

  return (
    <div className="comment truncated" onClick={handleClick}>
      {children}
    </div>
  );
}

function RenderComment({
  comment,
  ctx,
  path,
  maxLength,
}: {
  comment: string;
  ctx: Ctx;
  path: string;
  maxLength: number;
}) {
  // const by = others.length > 1 ? <span className="by">{commentAuthorText(comment.by)}</span> : null;

  const truncated = truncateComment(comment, maxLength, ctx);
  //TODO sometime maybe?
  // const enriched = (
  //   <span
  //     dangerouslySetInnerHTML={{
  //       __html: (by ? by.props.children : '') + enrichText(truncated),
  //     }}
  //   />
  // );

  if (truncated.length < comment.length) {
    return (
      <TruncatedComment path={path} ctx={ctx}>
        {comment}
      </TruncatedComment>
    );
  }

  return <span className="comment text-gray-500">{comment}</span>;
}

export function RenderInlineCommentsOf({ ctx, node, path }: { ctx: Ctx; node: Tree.Node; path: string }) {
  // if (!ctx.ctrl.showComments || !node.comments?.length) return null;
  // TODO context to disable comments
  // if (isEmpty(node.comment) return null;
  if (!node.comment) return null;

  return <RenderComment comment={node.comment} ctx={ctx} path={path} maxLength={300} />;
}

//TODO conceal?
export function RenderMainlineCommentsOf({
  ctx,
  node,
  // conceal,
  withColor,
  path,
}: {
  ctx: Ctx;
  node: Tree.Node;
  // conceal?: Conceal;
  withColor: boolean;
  path: string;
}) {
  // if (!ctx.ctrl.showComments || !node.comments?.length) return null;
  if (!node.comment) return null;

  const colorClass = withColor ? (node.ply % 2 === 0 ? ' black' : ' white') : '';

  return <RenderComment comment={node.comment} ctx={ctx} path={path} maxLength={400} />;
}

// END COMMENTS

//TODO
// export const renderIndexText = (ply: Ply, withDots?: boolean): string =>
//   plyToTurn(ply) + (withDots ? (ply % 2 === 1 ? '.' : '...') : '');

const contextMenuItems = [
  {
    label: 'Add Comment',
    icon: 'pi pi-comment',
    command: () => console.log('Add comment'),
  },
  {
    label: 'Delete From Here',
    icon: 'pi pi-trash',
    command: () => console.log('Delete from here'),
  },
];

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
  const deleteNode = useTrainerStore((s) => s.deleteNode);

  // console.log("delete node F", deleteNode);
  const { showMenu, contextSelectedPath } = useAppContextMenu();
  const jump = useTrainerStore((s) => s.jump);

  const path = opts.parentPath + node.id;
  const selectedPath = useTrainerStore.getState().selectedPath;

  const isContextSelected = path === contextSelectedPath;
  const activeClass = path === selectedPath ? 'bg-blue-400/50' : '';

  const items = [
    {
      label: 'Delete from here',
      command: () => {
        console.log('delete', path);
        deleteNode(path);
      },
    },
    { label: 'Promote', command: () => console.log('promote', path) },
  ];

  return (
    <div
      data-path={path}
      className={`move items-center self-start flex shadow-sm basis-[43.5%] shrink-0 grow-0
        leading-[27.65px] px-[7.9px] pr-[4.74px] overflow-hidden font-bold text-gray-600
        hover:bg-blue-400 select-none cursor-pointer
        ${activeClass} ${isContextSelected ? 'bg-orange-400' : ''}`}
      onContextMenu={(e) => showMenu(e, items, path)}
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
      className={`move variation text-[15.8px] px-[7.9px] pr-[4.74px] overflow-hidden hover:bg-blue-400 select-none cursor-pointer ${activeClass}`}
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

      {/* {RenderInlineCommentsOf(ctx, node, path)} */}
      <RenderInlineCommentsOf ctx={ctx} node={node} path={path}></RenderInlineCommentsOf>
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

// function RenderInlined({ ctx, nodes, opts }: { ctx: Ctx; nodes: Tree.Node[]; opts: Opts }) {
//   if (!nodes[1] || nodes[2]) return null;
//   if (treeOps.hasBranching(nodes[1], 6)) return null;
//   return (
//     <RenderMoveAndChildren
//       ctx={ctx}
//       node={nodes[0]}
//       opts={{ parentPath: opts.parentPath, isMainline: false, depth: opts.depth, inline: nodes[1] }}
//     />
//   );
// }

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

  const pathToTrain = useTrainerStore.getState().trainableContext?.startingPath || '';
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
*/
  const cs = node.children.filter((x, i) => {
    // console.log('x.san', x.san, 'vs', path[ply + 1].san);
    return (
      method == 'edit' ||
      (ply < path.length - 1 && x.san == path[ply + 1].san && (ctx.showComputer || !x.comp))
    );
  });
  const main = cs[0];
  if (!main) return null;

  if (opts.isMainline) {
    const isWhite = main.ply % 2 === 1;

    // const commentTags = RenderMainlineCommentsOf(ctx, main, conceal, true, opts.parentPath + main.id).filter(
    //   nonEmpty,
    // );

    // if (!cs[1] && isEmpty(commentTags) && !main.forceVariation) {

    //TODO why is this different than lichess ?  math.floor(..) line
    // console.log("node.comment", node)
    if (!cs[1] && !main.comment && !main.forceVariation) {
      // console.log("node", node)
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

    const mainChildren = (
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

    /*
  const cs = node.children.filter(x => ctx.showComputer || !x.comp),
    main = cs[0];
  if (!main) return;
    */
    const mainHasChildren = main.children[0]
    // Not entering here
    console.log('Hello??????');
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
          {/* {commentTags} */}
          {/* ctx, main, conceal, true, opts.parentPath + main.id */}
          <RenderMainlineCommentsOf ctx={ctx} node={main} withColor={true} path={opts.parentPath + main.id} />
          {/* ^^^^ COMPONENT */}
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
        {isWhite && mainHasChildren && IndexNode(Math.floor(main.ply / 2) + 1)}
        {isWhite && mainHasChildren && <EmptyMove />}
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
}

//TODO function should be part of state
export default function PgnTree() {
  const jump = useTrainerStore((s) => s.jump);

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


  const repertoire = useTrainerStore.getState().repertoire;
  const repertoireIndex = useTrainerStore.getState().repertoireIndex;
  const chapter = repertoire[repertoireIndex];
  if (!chapter) return;
  let root = chapter.tree.root;
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

  // const commentTags = (
  //   <RenderMainlineCommentsOf ctx={ctx} node={root} withColor={false} path={''}></RenderMainlineCommentsOf>
  // );

  //TODO should be false 
  const blackStarts = (root.ply & 1) === 1;

  return (
    <ContextMenuProvider>
      <div className="h-[400px] bg-white">
        <div
          onMouseDown={handleMouseDown}
          className="tview2 tview2-column overflow-y-auto max-h-[400px] flex flex-row flex-wrap items-start bg-white"
        >
          {/* {    !isEmpty(commentTags) && h('interrupt', commentTags)} */}
          {root.comment && (
            <div className="interrupt flex-[0_0_100%] max-w-full bg-zebra border-t border-b border-border">
              <RenderMainlineCommentsOf
                ctx={ctx}
                node={root}
                withColor={false}
                path={''}
              ></RenderMainlineCommentsOf>
            </div>
          )}
          {/* {blackStarts && root.ply}
          {blackStarts && <EmptyMove />} */}
          <RenderChildren ctx={ctx} node={root} opts={{ parentPath: '', isMainline: true, depth: 0 }} />
        </div>
      </div>
    </ContextMenuProvider>
  );
}
//TODO what is a comment tag?
