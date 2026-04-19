// TODO: comments:
// TODO use primereact icons instead?
//TODO fix off-by-one bug with ply (compare w/ lichess)
//TODO adjust scrollheight automatically when clicking a move
//TODO fix formatting. use retroLine?
import { useTrainerStore } from '../../store/state';
import { useAppContextMenu } from './ContextMenuProvider';

// import { path as treePath, ops as treeOps, type TreeWrapper } from '../tree/tree';

import { ContextMenuProvider } from './ContextMenuProvider';

import React, { useEffect, useRef, useState } from 'react';
import { TrainableNode } from '../../types/training';
import { getNodeList, nodeAtPath, hasBranching } from '../../util/tree';
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
import {
  Trash2,
  Ban,
  CheckCircle2,
  MessageSquarePlus,
  ChevronsRightLeftIcon,
  EllipsisIcon,
  ChevronDown,
  CalendarClockIcon,
  ChartBarBig,
  ChartBarBigIcon,
} from 'lucide-react';
import type { Card } from 'ts-fsrs';
import type { TrainingData } from '../../types/training';
import { useAuthStore } from '../../store/auth';
import { userCard } from '../../util/userCard';

function formatDueIn(card: Card): string {
  const nowMs = Date.now();
  const dueMs = new Date(card.due).getTime();
  const diffMs = dueMs - nowMs;

  if (diffMs <= 0) return 'now';

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  const years = Math.floor(days / 365);
  return `${years}y`;
}

function RepsBar({ reps, lapses }: { reps: number; lapses: number }) {
  const total = reps + lapses;
  if (total === 0) return null;
  const successPct = (reps / total) * 100;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 flex-1 rounded-full overflow-hidden flex bg-gray-200" style={{ minWidth: 48 }}>
        <div className="bg-emerald-500 h-full" style={{ width: `${successPct}%` }} />
        <div className="bg-red-400 h-full" style={{ width: `${100 - successPct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 tabular-nums whitespace-nowrap">
        {reps}/{total}
      </span>
    </div>
  );
}

function CardStateSection({ card }: { card: Card }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="px-3 py-2">
      <div className="flex flex-col gap-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <CalendarClockIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-gray-500">due in</span>
          <span className="text-gray-900 font-medium">{formatDueIn(card)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ChartBarBigIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-gray-500 shrink-0">success rate</span>
          <span className="flex-1">
            <RepsBar reps={card.reps} lapses={card.lapses} />
          </span>
        </div>
      </div>
      <button
        type="button"
        className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition select-none"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowAdvanced(!showAdvanced);
        }}
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        Advanced
      </button>
      {showAdvanced && (
        <div className="flex gap-3 text-xs mt-1">
          <span className="text-gray-400">
            stability <span className="text-gray-700 font-medium">{card.stability.toFixed(2)}d</span>
          </span>
          <span className="text-gray-400">
            difficulty <span className="text-gray-700 font-medium">{card.difficulty.toFixed(2)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function OtherUsersTraining({ entries }: { entries: [string, Card][] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-3 py-1">
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition select-none"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {entries.length} other {entries.length === 1 ? 'user' : 'users'} trained
      </button>
      {expanded && (
        <div className="mt-1.5 flex flex-col gap-2">
          {entries.map(([sub, card]) => (
            <div key={sub} className="border-l-2 border-gray-200 pl-2">
              <div className="text-[10px] text-gray-400 truncate mb-0.5" title={sub}>
                {sub.slice(0, 12)}...
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <CalendarClockIcon className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="text-gray-500">due in</span>
                  <span className="text-gray-900 font-medium">{formatDueIn(card)}</span>
                </div>
                <RepsBar reps={card.reps} lapses={card.lapses} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const contextMenuItems = (path: string, data: TrainingData) => {
  const deleteLine = useTrainerStore((s) => s.deleteLine);
  const disableLine = useTrainerStore((s) => s.disableLine);
  const enableLine = useTrainerStore((s) => s.enableLine);
  const { training, san, enabled } = data;
  const myCard = userCard(data);

  // other users who have trained this move (excluding the current user)
  const mySub = useAuthStore.getState().user?.sub;
  const otherEntries = Object.entries(training ?? {}).filter(([sub]) => sub !== mySub);

  return [
    // Header
    {
      label: san,
      disabled: true,
      template: (item: any) => (
        <div className="px-3 py-2 font-semibold text-gray-800 select-none truncate flex gap-2">
          <span>{item.label}</span>
          <span>•</span>
          <span>{enabled ? 'enabled' : 'disabled'}</span>
        </div>
      ),
    },

    { separator: true },

    // Card state for current user
    ...(myCard
      ? [
          {
            template: () => <CardStateSection card={myCard} />,
          },
          { separator: true },
        ]
      : []),

    // Other users' training state (collapsible)
    ...(otherEntries.length > 0
      ? [
          {
            template: () => <OtherUsersTraining entries={otherEntries} />,
          },
          { separator: true },
        ]
      : []),

    // Line actions from here
    {
      template: () => (
        <div className="px-3 py-2">
          <div className="text-xs font-medium text-gray-500 mb-1.5 select-none">Line actions from here</div>
          <div className="flex gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 hover:bg-gray-50 active:bg-gray-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteLine(path);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 text-gray-500" />
              Delete
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-800 hover:bg-gray-100 active:bg-gray-200"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                disableLine(path);
              }}
            >
              <Ban className="w-3.5 h-3.5 text-gray-500" />
              Disable
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 active:bg-blue-800"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                enableLine(path);
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Enable
            </button>
          </div>
        </div>
      ),
    },
  ];
};

const MAX_LEN_MAINLINE_COMMENT = 300;
const MAX_LEN_INLINE_COMMENT = 200;
const MAX_BRANCH_DEPTH = 5; //TODO can conditionally shrink this on mobile?

// COMMENTS

function truncateComment(text: string, len: number, ctx: Ctx) {
  return ctx.truncateComments && text.length > len ? text.slice(0, len) : text;
}

function enrichText(text: string): string {
  // Replace with actual formatting logic (links, markdown, etc.)
  return text;
}

// -------------------------
// Components
// -------------------------

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
  const [expanded, setExpanded] = useState(false); //TODO can we do this with a class instead? OPTIMIZATION
  const selectedPath = useTrainerStore.getState().selectedPath;
  const truncated = truncateComment(comment, maxLength, ctx);
  const isTruncated = truncated.length < comment.length;

  const displayText = isTruncated && !expanded ? truncated : comment;
  const isCommentOfActiveMove = path === selectedPath;
  const selectedClass = isCommentOfActiveMove
    ? 'text-blue-700 bg-blue-50 rounded shadow-inner ring-1 ring-blue-200'
    : '';

  return (
    <span
      className={`comment inline-block text-gray-500 mx-2 break-words px-2 ${selectedClass}`}
      style={
        isCommentOfActiveMove
          ? {
              maskImage:
                'linear-gradient(to right, transparent, black 8px, black calc(100% - 8px), transparent)',
            }
          : undefined
      }
    >
      {displayText}
      {isTruncated && (
        <span
          className="text-gray-500 bg-gray-200 rounded-md cursor-pointer ml-1 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? (
            <ChevronsRightLeftIcon className="inline w-4 h-4" />
          ) : (
            <EllipsisIcon className="inline w-4 h-4" />
          )}
        </span>
      )}
    </span>
  );
}

export function RenderInlineCommentsOf({ ctx, node, path }: { ctx: Ctx; node: TrainableNode; path: string }) {
  // if (!ctx.ctrl.showComments || !node.comments?.length) return null;
  // TODO context to disable comments
  // if (isEmpty(node.comment) return null;
  if (!node.data.comment) return null;

  return (
    <RenderComment comment={node.data.comment} ctx={ctx} path={path} maxLength={MAX_LEN_INLINE_COMMENT} />
  );
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

  return (
    <RenderComment comment={node.data.comment} ctx={ctx} path={path} maxLength={MAX_LEN_MAINLINE_COMMENT} />
  );
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
  const activeClass = path === selectedPath ? 'bg-blue-500 rounded-md active' : '';

  const { repertoire, repertoireIndex } = useTrainerStore.getState();
  const chapter = repertoire[repertoireIndex];
  if (!chapter) return;

  const nodeFromPath = nodeAtPath(chapter.root, path);

  const items = contextMenuItems(path, nodeFromPath.data);

  return (
    <div
      data-path={path}
      className={`move items-center self-start flex shadow-sm basis-[43.5%] shrink-0 grow-0
        leading-[27.65px] px-[7.9px] pr-[4.74px] overflow-hidden font-bold
        hover:bg-sky-400 hover:rounded-md select-none cursor-pointer
        text-gray-700
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
  const items = contextMenuItems(path, nodeFromPath.data);
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
  const activeClass = path == selectedPath ? 'bg-blue-500 rounded-md active' : '';

  return (
    <span
      data-path={path}
      className={`move variation inline-block max-w-full align-top
  whitespace-normal break-words
  px-[7.9px] pr-[4.74px]
  hover:bg-sky-400 hover:rounded-md select-none cursor-pointer ${activeClass}
  text-gray-700
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
    <span className="inline">
      {'( '}
      <RenderMoveAndChildren
        ctx={ctx}
        node={node}
        opts={{
          ...opts,
          withIndex: true,
          isMainline: false,
          inline: undefined,
        }}
      />
      {' ) '}
    </span>
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
  // At high depth, render variations inline with parens instead of nested branches
  if (opts.depth >= MAX_BRANCH_DEPTH) {
    return (
      <span className="lines inline">
        {nodes.map((n) => (
          <span className="inline" key={n.data.id}>
            {'('}
            <RenderMoveAndChildren
              ctx={ctx}
              node={n}
              opts={{
                parentPath: opts.parentPath,
                isMainline: false,
                depth: opts.depth + 1,
                withIndex: true,
              }}
            />
            {')'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className={`lines ${!nodes[1] ? 'single' : ''}`}>
      {nodes.map((n) => {
        return (
          <div className="line block relative ps-[7px]" key={n.data.id}>
            <div className="branch" />
            <RenderMoveAndChildren
              ctx={ctx}
              node={n}
              opts={{
                parentPath: opts.parentPath,
                isMainline: false,
                depth: opts.depth + 1,
                withIndex: true,
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
          <RenderMainlineCommentsOf
            ctx={ctx}
            node={main}
            withColor={true}
            path={opts.parentPath + main.data.id}
          />
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

  // Inline rendering: exactly 2 branches, second branch has no sub-branching within 6 moves
  if (cs[1] && !cs[2] && !hasBranching(cs[1], 6)) {
    return (
      <RenderMoveAndChildren
        ctx={ctx}
        node={cs[0]}
        opts={{
          parentPath: opts.parentPath,
          isMainline: false,
          depth: opts.depth,
          inline: cs[1],
        }}
      />
    );
  }

  return <RenderLines ctx={ctx} parentNode={node} nodes={cs} opts={opts} />;
}

function ChildMoveButtons() {
  const jump = useTrainerStore((s) => s.jump);
  const selectedPath = useTrainerStore((s) => s.selectedPath);
  const repertoire = useTrainerStore.getState().repertoire;
  const repertoireIndex = useTrainerStore.getState().repertoireIndex;
  const trainingMethod = useTrainerStore.getState().trainingMethod;
  const chapter = repertoire[repertoireIndex];
  if (trainingMethod != 'edit' || !chapter) return null;

  const node = selectedPath ? nodeAtPath(chapter.root, selectedPath) : chapter.root;
  if (!node || node.children.length <= 1) return null;

  return (
    <div className="shrink-0 bg-white border-t border-gray-200 px-2 py-1.5">
      <div className="flex flex-wrap gap-1.5 justify-start">
        {node.children.map((child) => (
          <button
            key={child.data.id}
            className="px-2.5 py-1 text-sm font-semibold rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition shadow-sm basis-[calc(50%-0.1875rem)]"
            onClick={() => jump(selectedPath + child.data.id)}
          >
            {renderIndex(child.data.ply, true)} {child.data.san}
          </button>
        ))}
      </div>
    </div>
  );
}

//TODO function should be part of state
export default function PgnTree({ setActiveMoveId }) {
  const jump = useTrainerStore((s) => s.jump);
  const trainingMethod = useTrainerStore((s) => s.trainingMethod);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trainingMethod == 'edit') return;
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
      });
    }
  }, [trainingMethod]);

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
  // console.log("ROOT", root);
  // console.log('root path');
  // TODO conditionally use path or root, depending on context

  // TODO ???
  // TODO handle multiple root nodes, possibly upon PGN import... (dont allow chapter w/ multiple roots)

  const ctx: Ctx = {
    currentPath: '',
    truncateComments: true,
  };

  //TODO should be false
  // const blackStarts = (root.data.ply & 1) === 1;
  return (
    <ContextMenuProvider>
      <div className="relative h-full flex flex-col bg-gray-100">
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          className="tview2 tview2-column repertoire-scroll overflow-y-auto flex flex-row flex-wrap items-start bg-white min-h-0"
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
        <ChildMoveButtons />
      </div>
    </ContextMenuProvider>
  );
}
//TODO what is a comment tag?
