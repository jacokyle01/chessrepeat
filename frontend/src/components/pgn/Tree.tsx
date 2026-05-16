// TODO: comments:
// TODO use primereact icons instead?
//TODO fix off-by-one bug with ply (compare w/ lichess)
//TODO adjust scrollheight automatically when clicking a move
//TODO fix formatting. use retroLine?
import { useTrainerStore } from '../../store/state';
import { useAppContextMenu } from './ContextMenuProvider';

// import { path as treePath, ops as treeOps, type TreeWrapper } from '../tree/tree';

import { ContextMenuProvider } from './ContextMenuProvider';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  PencilIcon,
  ChevronsRightLeftIcon,
  EllipsisIcon,
} from 'lucide-react';
import type { TrainingData } from '../../types/training';

type CommentEditContextValue = {
  editingPath: string | null;
  startEditing: (path: string) => void;
  stopEditing: () => void;
};

const CommentEditContext = createContext<CommentEditContextValue>({
  editingPath: null,
  startEditing: () => {},
  stopEditing: () => {},
});

const useMoveContextMenuItems = (path: string, data: TrainingData) => {
  const deleteLine = useTrainerStore((s) => s.deleteLine);
  const { startEditing } = useContext(CommentEditContext);
  const { hideMenu } = useAppContextMenu();

  return [
    {
      template: () => (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 active:bg-gray-200"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteLine(path);
            hideMenu();
          }}
        >
          <Trash2 className="w-4 h-4 text-gray-500" />
          Delete from here
        </button>
      ),
    },
    {
      template: () => (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 active:bg-gray-200"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startEditing(path);
            hideMenu();
          }}
        >
          <PencilIcon className="w-4 h-4 text-gray-500" />
          {data.comment ? 'Edit comment' : 'Add comment'}
        </button>
      ),
    },
  ];
};

const useCommentContextMenuItems = (path: string) => {
  const { startEditing } = useContext(CommentEditContext);
  const { hideMenu } = useAppContextMenu();
  return [
    {
      template: () => (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 active:bg-gray-200"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startEditing(path);
            hideMenu();
          }}
        >
          <PencilIcon className="w-4 h-4 text-gray-500" />
          Edit comment
        </button>
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

function CommentEditor({ path, initial }: { path: string; initial: string }) {
  const setCommentAt = useTrainerStore((s) => s.setCommentAt);
  const { stopEditing } = useContext(CommentEditContext);
  const [draft, setDraft] = useState(initial);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, []);

  const save = () => {
    setCommentAt(draft, path);
    stopEditing();
  };

  const cancel = () => stopEditing();

  const isDirty = draft !== initial;

  return (
    <div
      className="flex flex-col gap-1 w-full"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={draft}
        placeholder="Add comment…"
        onChange={(e) => {
          setDraft(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
        className="w-full text-sm text-gray-700 rounded-md border border-gray-300 p-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-blue"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          className="text-xs px-2 py-0.5 text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!isDirty}
          className={`text-xs font-semibold px-2 py-0.5 rounded transition ${
            isDirty
              ? 'bg-brand-blue text-white hover:brightness-110'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Save
        </button>
      </div>
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
  const [expanded, setExpanded] = useState(false); //TODO can we do this with a class instead? OPTIMIZATION
  const selectedPath = useTrainerStore.getState().selectedPath;
  const { showMenu } = useAppContextMenu();
  const items = useCommentContextMenuItems(path);
  const truncated = truncateComment(comment, maxLength, ctx);
  const isTruncated = truncated.length < comment.length;

  const displayText = isTruncated && !expanded ? truncated : comment;
  const isCommentOfActiveMove = path === selectedPath;
  const selectedClass = isCommentOfActiveMove
    ? 'text-brand-blue bg-blue-50 shadow-inner ring-1 ring-blue-200 text-gray-700'
    : '';

  return (
    <span
      className={`comment inline-block text-gray-500 break-words px-1 rounded cursor-pointer ${selectedClass}`}
      onContextMenu={(e) => showMenu(e, items, path)}
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
  const activeClass = path === selectedPath ? 'bg-brand-blue rounded-md active' : '';

  const { repertoire, repertoireIndex } = useTrainerStore.getState();
  const chapter = repertoire[repertoireIndex];
  if (!chapter) return;

  const nodeFromPath = nodeAtPath(chapter.root, path);

  const items = useMoveContextMenuItems(path, nodeFromPath.data);

  return (
    <div
      data-path={path}
      className={`move items-center self-start flex shadow-sm basis-[43.5%] shrink-0 grow-0
        leading-[27.65px] px-[7.9px] pr-[4.74px] overflow-hidden font-bold
        hover:bg-brand-blue-light hover:rounded-md select-none cursor-pointer
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
  const items = useMoveContextMenuItems(path, nodeFromPath.data);
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
  const activeClass = path == selectedPath ? 'bg-brand-blue rounded-md active' : '';

  return (
    <span
      data-path={path}
      className={`move variation inline-block max-w-full align-top
  whitespace-normal break-words
  px-[7.9px] pr-[4.74px]
  hover:bg-brand-blue-light hover:rounded-md select-none cursor-pointer ${activeClass}
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

function BottomCommentEditor() {
  const { editingPath } = useContext(CommentEditContext);
  const repertoire = useTrainerStore((s) => s.repertoire);
  const repertoireIndex = useTrainerStore((s) => s.repertoireIndex);
  if (editingPath === null) return null;
  const chapter = repertoire[repertoireIndex];
  if (!chapter) return null;
  const node = nodeAtPath(chapter.root, editingPath);
  if (!node) return null;

  return (
    <div className="shrink-0 bg-white border-t border-gray-200 px-2 py-2">
      <CommentEditor key={editingPath} path={editingPath} initial={node.data.comment ?? ''} />
    </div>
  );
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
            className="px-2.5 py-1 text-sm font-semibold rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-blue-50 hover:border-brand-blue hover:text-brand-blue transition shadow-sm basis-[calc(50%-0.1875rem)]"
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
  const selectedPath = useTrainerStore((s) => s.selectedPath);
  const trainingMethod = useTrainerStore((s) => s.trainingMethod);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);

  // Close the inline editor when leaving edit mode or jumping to a different move.
  useEffect(() => {
    if (trainingMethod !== 'edit') setEditingPath(null);
  }, [trainingMethod]);
  useEffect(() => {
    if (editingPath !== null && editingPath !== selectedPath) setEditingPath(null);
  }, [selectedPath, editingPath]);

  const commentEditValue: CommentEditContextValue = {
    editingPath,
    startEditing: (p: string) => {
      jump(p);
      setEditingPath(p);
    },
    stopEditing: () => setEditingPath(null),
  };

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
    <CommentEditContext.Provider value={commentEditValue}>
    <ContextMenuProvider>
      <div className="relative h-full flex flex-col bg-gray-100">
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          className="tview2 tview2-column tree-scroll overflow-y-auto flex flex-row flex-wrap items-start bg-white min-h-0"
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
        <BottomCommentEditor />
        <ChildMoveButtons />
      </div>
    </ContextMenuProvider>
    </CommentEditContext.Provider>
  );
}
//TODO what is a comment tag?
