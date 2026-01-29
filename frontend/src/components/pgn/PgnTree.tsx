// TODO: comments:
// TODO use primereact icons instead?
//TODO fix off-by-one bug with ply (compare w/ lichess)
//TODO adjust scrollheight automatically when clicking a move
//TODO fix formatting. use retroLine?
import { useTrainerStore } from '../../state/state';
import { useAppContextMenu } from './ContextMenuProvider';

// import { path as treePath, ops as treeOps, type TreeWrapper } from '../tree/tree';

import { ContextMenuProvider } from './ContextMenuProvider';

import React, { useRef } from 'react';
import { TrainableNode } from '../../types/training';
import { ChevronRight, Trash } from 'lucide-react';
import { getNodeList, nodeAtPath } from '../../util/tree';
export interface Opts {
  parentPath: string;
  isMainline: boolean;
  depth: number;
  inline?: TrainableNode;
  withIndex?: boolean;
  truncate?: number;
}

export interface Ctx {
  truncateComments: boolean;
  currentPath: string | undefined;
}

const isEmpty = (a: any | undefined): boolean => !a || a.length === 0;

//TODO right clicking these should provide more training info
//TODO disable line option
//TODO mark line as seen option
const contextMenuItems = (path: string, san: string) => {
  const deleteLine = useTrainerStore((s) => s.deleteLine);
  const disableLine = useTrainerStore((s) => s.disableLine);
  const enableLine = useTrainerStore((s) => s.enableLine);

  return [
    // Header
    {
      label: san,
      disabled: true,
      template: (item: any) => (
        <div className="px-3 py-2 font-semibold text-gray-800 select-none">{item.label}</div>
      ),
    },

    { separator: true },

    {
      label: 'Delete from here',
      icon: 'pi pi-trash',
      command: () => deleteLine(path),
    },

    // ✅ Combined Enable / Disable row
    {
      template: () => (
        <div
          className="flex items-center justify-between gap-2 px-3 py-2
                rounded-md transition hover:bg-gray-50"
        >
          <span className="text-sm text-gray-700">Line state</span>

          <div className="flex gap-1">
            <button
              className="rounded-md px-2 py-1 text-xs font-medium
                         bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={() => disableLine(path)}
            >
              Disable
            </button>

            <button
              className="rounded-md px-2 py-1 text-xs font-medium
                         bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => enableLine(path)}
            >
              Enable
            </button>
          </div>
        </div>
      ),
    },

    { separator: true },

    {
      label: 'Add Comment',
      icon: 'pi pi-comment',
      command: () => {
        const comment = prompt('Enter a comment:');
        if (comment != null) {
          useTrainerStore.getState().setCommentAt(comment, path);
        }
      },
    },
  ];
};

// COMMENTS

function truncateComment(text: string, len: number, ctx: Ctx) {
  return ctx.truncateComments && text.length > len ? text.slice(0, len - 10) + ' [...]' : text;
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
  const repertoire = useTrainerStore.getState().repertoire;
  const repertoireIndex = useTrainerStore.getState().repertoireIndex;
  const setCommentAt = useTrainerStore((s) => s.setCommentAt);
  const chapter = repertoire[repertoireIndex];
  if (!chapter) return;
  // let root = chapter.root;

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
        {comment + 'SDFSDF'}
        <Trash />
      </TruncatedComment>
    );
  }

  // console.log('path', path);
  return (
    <span className="comment inline-block text-gray-500 mx-2">
      {comment}
      {/* <Trash
        className="inline-block w-5 h-5 align-text-bottom ml-5 text-black"
        onClick={() => setCommentAt(root, '', path)}
      /> */}
    </span>
  );
}

export function RenderInlineCommentsOf({ ctx, node, path }: { ctx: Ctx; node: TrainableNode; path: string }) {
  // if (!ctx.ctrl.showComments || !node.comments?.length) return null;
  // TODO context to disable comments
  // if (isEmpty(node.comment) return null;
  if (!node.data.comment) return null;

  return <RenderComment comment={node.data.comment} ctx={ctx} path={path} maxLength={300} />;
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
  node: TrainableNode;
  // conceal?: Conceal;
  withColor: boolean;
  path: string;
}) {
  // if (!ctx.ctrl.showComments || !node.comments?.length) return null;
  if (!node.data.comment) return null;

  const colorClass = withColor ? (node.data.ply % 2 === 0 ? ' black' : ' white') : '';

  return <RenderComment comment={node.data.comment} ctx={ctx} path={path} maxLength={400} />;
}

// END COMMENTS

//TODO
export const renderIndexText = (ply: number, withDots?: boolean): string =>
  plyToTurn(ply) + (withDots ? (ply % 2 === 1 ? '.' : '...') : '');

//TODO maybe dont style this as if it was a real move?
function EmptyMove() {
  return (
    <div className="empty move items-center self-start flex shadow-sm basis-[43.5%] shrink-0 grow-0 leading-[27.65px] px-[7.9px] overflow-hidden font-bold text-gray-600">
      ...
    </div>
  );
}

export const plyToTurn = (ply: number): number => Math.floor((ply - 1) / 2) + 1;

export const renderIndex = (ply: number, withDots?: boolean): string =>
  plyToTurn(ply) + (withDots ? (ply % 2 === 1 ? '.' : '...') : '');

function IndexNode(ply: number) {
  return (
    <div className="index self-stretch flex items-center self-start basis-[13%] justify-center border-r bg-[#f9f9f9] text-[#999]">
      {/* {renderIndex(ply, true)} */}
      {ply}
    </div>
  );
}

function RenderMainlineMove({ ctx, node, opts }: { ctx: Ctx; node: TrainableNode; opts: Opts }) {
  // console.log("delete node F", deleteNode);
  const { showMenu, contextSelectedPath } = useAppContextMenu();
  const jump = useTrainerStore((s) => s.jump);

  const path = opts.parentPath + node.data.id;
  const selectedPath = useTrainerStore.getState().selectedPath;

  const isContextSelected = path === contextSelectedPath;
  const activeClass = path === selectedPath ? 'bg-blue-400/50 active' : '';

  const { repertoire, repertoireIndex } = useTrainerStore.getState();
  const chapter = repertoire[repertoireIndex];
  if (!chapter) return;

  const nodeFromPath = nodeAtPath(chapter.root, path);

  // const items = [
  //   {
  //     label: nodeFromPath.data.san,
  //     disabled: true,
  //     className: 'px-3 py-2 font-semibold text-gray-800 cursor-default',
  //     template: (item: any) => (
  //       <div className="px-3 py-2 font-semibold text-gray-800 select-none">{item.label}</div>
  //     ),
  //   },
  //   { separator: true },

  //   {
  //     label: 'Delete from here',
  //     command: () => {
  //       console.log('delete', path);
  //       deleteNode(path);
  //     },
  //   },
  //   { label: 'Promote', command: () => console.log('promote', path) },
  //   {
  //     label: 'Add Comment',
  //     command: () => {
  //       const comment = prompt('Enter a comment:');
  //       if (comment !== null) {
  //         const { repertoire, repertoireIndex } = useTrainerStore.getState();
  //         const chapter = repertoire[repertoireIndex];
  //         if (!chapter) return;
  //         useTrainerStore.getState().setCommentAt(comment, path);
  //       }
  //     },
  //   },
  // ];
  const items = contextMenuItems(path, nodeFromPath.data.san);

  return (
    <div
      data-path={path}
      className={`move items-center self-start flex shadow-sm basis-[43.5%] shrink-0 grow-0
        leading-[27.65px] px-[7.9px] pr-[4.74px] overflow-hidden font-bold
        hover:bg-blue-400 select-none cursor-pointer
        ${!node.data.training.disabled ? ' text-gray-600' : 'text-gray-400'} 
        ${activeClass} ${isContextSelected ? 'bg-orange-400' : ''} `}
      onContextMenu={(e) => showMenu(e, items, path)}
    >
      {node.data.san}
    </div>
  );
}

function RenderVariationMove({ ctx, node, opts }: { ctx: Ctx; node: TrainableNode; opts: Opts }) {
  const { showMenu, contextSelectedPath } = useAppContextMenu();

  const path = opts.parentPath + node.data.id;

  const { repertoire, repertoireIndex } = useTrainerStore.getState();
  const chapter = repertoire[repertoireIndex];
  if (!chapter) return;

  const nodeFromPath = nodeAtPath(chapter.root, path);
  const items = contextMenuItems(path, nodeFromPath.data.san);
  const withIndex = opts.withIndex || node.data.ply % 2 === 1;
  const content = (
    <>
      {/* // TODO here */}
      {/* {withIndex && `${Math.floor(node.ply / 2) + 1}. `} */}
      {withIndex && renderIndex(node.data.ply, true)}
      {node.data.san}
    </>
  );
  // const classes = nodeClasses(ctx, node, path);

  const selectedPath = useTrainerStore.getState().selectedPath;
  const activeClass = path == selectedPath ? 'bg-blue-400/50 rounded-md active' : '';

  return (
    <span
      data-path={path}
      className={`move variation inline-block max-w-full align-top
  whitespace-normal break-words
  px-[7.9px] pr-[4.74px]
  hover:bg-blue-400 select-none cursor-pointer ${activeClass}
          ${!node.data.training.disabled ? ' text-gray-600' : 'text-gray-400'} 
  `}
      onContextMenu={(e) => showMenu(e, items, path)}
    >
      {content}
    </span>
  );
}

type RenderMainlineMoveOfProps = {
  ctx: Ctx;
  node: TrainableNode;
  opts: Opts;
};

function RenderMoveOf({ ctx, node, opts }: { ctx: Ctx; node: TrainableNode; opts: Opts }) {
  return opts.isMainline ? (
    <RenderMainlineMove ctx={ctx} node={node} opts={opts} />
  ) : (
    <RenderVariationMove ctx={ctx} node={node} opts={opts} />
  );
}

function RenderInline({ ctx, node, opts }: { ctx: Ctx; node: TrainableNode; opts: Opts }) {
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

function RenderMoveAndChildren({ ctx, node, opts }: { ctx: Ctx; node: TrainableNode; opts: Opts }) {
  const path = opts.parentPath + node.data.id;
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

export function RenderLines({ ctx, parentNode, nodes, opts }) {
  let collapsed = false;
  // const collapsed =
  //   parentNode.collapsed === undefined ? opts.depth >= 2 && opts.depth % 2 === 0 : parentNode.collapsed;
  // console.log('render lines w/ parent'
  // , parentNode.san);
  if (collapsed) {
    return (
      <div className={`lines basis-full w-full ${!nodes[1] ? 'single' : ''} ${collapsed ? 'collapsed' : ''}`}>
        {/* assume uncollapsed */}
        {nodes.map((n) => {
          return (
            <div className="flex">
              <ChevronRight color="gray" />
              <div className="line block relative ps-[7px] w-full min-w-0" key={n.id}>
                <div className="branch" />
                <RenderMoveAndChildren
                  ctx={ctx}
                  node={n}
                  opts={{
                    ...opts,
                    withIndex: true,
                    isMainline: false,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`lines ${!nodes[1] ? 'single' : ''} ${collapsed ? 'collapsed' : ''}`}>
      {nodes.map((n) => {
        // const retro = retroLine(ctx, n);
        // if (retro) return retro;

        // const truncate = n.comp && !treePath.contains(ctx.ctrl.path, opts.parentPath + n.id) ? 3 : undefined;

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

function RenderChildren({ ctx, node, opts }: { ctx: Ctx; node: TrainableNode; opts: Opts }) {
  let repertoire = useTrainerStore.getState().repertoire;
  let repertoireIndex = useTrainerStore.getState().repertoireIndex;
  const chapter = repertoire[repertoireIndex];
  const root = chapter.root;

  const pathToTrain = useTrainerStore.getState().trainableContext?.startingPath || '';
  const path: TrainableNode[] = getNodeList(root, pathToTrain);

  const method = useTrainerStore.getState().trainingMethod;

  // console.log('node', node);
  const ply = node.data.ply;
  const cs = node.children.filter((x, i) => {
    // console.log('x.san', x.san, 'vs', path[ply + 1].san);
    return (
      method == 'edit' ||
      (ply < path.length - 1 && x.data.san == path[ply + 1].data.san && (ctx.showComputer || !x.comp))
    );
  });
  const main = cs[0];
  if (!main) return null;

  if (opts.isMainline) {
    const isWhite = main.data.ply % 2 === 1;

    //TODO why is this different than lichess ?  math.floor(..) line
    //TODO force variation?
    if (!cs[1] && !main.data.comment && true) {
      return (
        <>
          {isWhite && IndexNode(Math.floor(main.data.ply / 2) + 1)}
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
          parentPath: opts.parentPath + main.data.id,
          isMainline: true,
          depth: opts.depth,
        }}
      />
    );
    const mainHasChildren = main.children[0];
    // Not entering here
    return (
      <>
        {isWhite && IndexNode(Math.floor(main.data.ply / 2) + 1)}
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

        {isWhite && false && <EmptyMove />}
        <div className="interrupt flex-[0_0_100%] max-w-full bg-zebra border-t border-b border-border shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2),_inset_-1px_-1px_3px_rgba(255,255,255,0.6)]">
          {/* {commentTags} */}
          {/* ctx, main, conceal, true, opts.parentPath + main.id */}
          <RenderMainlineCommentsOf ctx={ctx} node={main} withColor={true} path={opts.parentPath + main.data.id} />
          {/* ^^^^ COMPONENT */}
          <RenderLines
            ctx={ctx}
            parentNode={node}
            nodes={cs.slice(1)}
            opts={{
              parentPath: opts.parentPath,
              isMainline: !main.forceVariation,
              depth: opts.depth,
              // noConceal: true,
            }}
          />
        </div>
        {isWhite && mainHasChildren && IndexNode(Math.floor(main.data.ply / 2) + 1)}
        {isWhite && mainHasChildren && <EmptyMove />}
        {mainChildren}
      </>
    );
  }

  if (!cs[1]) {
    return <RenderMoveAndChildren ctx={ctx} node={cs[0]} opts={opts} />;
  }

  const nodes = cs;
  let shouldRenderLines = !nodes[1] || nodes[2] || false;
  // console.log('in render children');
  return <RenderLines ctx={ctx} parentNode={node} nodes={cs} opts={opts} />;

  // TODO - fix infinite render loop, figure out if we need renderInlined
  // TODO - we just need a way to ensure that the whole PGN is viewable
}

//TODO function should be part of state
export default function PgnTree({ setActiveMoveId }) {
  const jump = useTrainerStore((s) => s.jump);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle left click or touch
    if (e.button !== 0) return;

    // Traverse DOM to find the nearest element with a data-path
    let el = e.target as HTMLElement;
    while (el && el !== e.currentTarget) {
      const path = el.getAttribute('data-path');
      if (path) {
        setActiveMoveId(el.id);
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
  let root = chapter.root;
  if (!root) return;
  // console.log('root path');
  // TODO conditionally use path or root, depending on context

  // TODO ???
  // TODO handle multiple root nodes, possibly upon PGN import... (dont allow chapter w/ multiple roots)

  const ctx: Ctx = {
    currentPath: '',
    truncateComments: false,
  };

  //TODO should be false
  // const blackStarts = (root.data.ply & 1) === 1;
  return (
    <ContextMenuProvider>
      <div className="h-[400px] bg-white">
        <div
          onMouseDown={handleMouseDown}
          className="tview2 tview2-column overflow-y-auto max-h-[400px] flex flex-row flex-wrap items-start bg-white"
        >
          {root.data.comment && (
            <div className="interrupt flex-[0_0_100%] max-w-full bg-zebra border-t border-b border-border shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2),_inset_-1px_-1px_3px_rgba(255,255,255,0.6)]">
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
