// The chapter move list, arranged the way lichess' `tview2-column` arranges it
// (ui/analyse/src/treeView/columnView.ts + inlineView.ts):
//
//   - the mainline is a flat run of cells in one wrapping flex row: a narrow
//     move-number cell before every white move, then the moves themselves;
//   - anything that breaks the mainline (a comment, a set of sidelines) is an
//     `.interrupt` taking a full-width row. When the interrupted move was
//     white's, an empty cell fills black's slot before the interrupt and a
//     fresh index + empty cell re-open the row after it, so black's reply
//     stays in the right column;
//   - sidelines nest as `.lines > .line`, and a lone short sub-variation is
//     folded into parentheses inline after its first move instead of nesting.
//
// Disclosure (collapsing) and forced variations aren't part of chessrepeat's
// data model, so those branches of the lichess code are left out.
import { useTrainerStore, MAX_COMMENT_CHARS } from '../../store/state';
import { useAppContextMenu } from './ContextMenuProvider';

import { ContextMenuProvider } from './ContextMenuProvider';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { TrainableNode } from '../../types/training';
import { getNodeList, nodeAtPath, hasBranching } from '../../util/tree';
import './Tree.css';

/** Everything a node needs to know about where it sits, mirroring lichess' `Args`. */
export interface Args {
  parentPath: string;
  parentNode: TrainableNode;
  isMainline: boolean;
  /** the sideline this node belongs to renders its siblings in parentheses */
  parenthetical?: boolean;
}

export interface Ctx {
  truncateComments: boolean;
  currentPath: string | undefined;
  /** children to draw: all of them in edit mode, only the trained line otherwise */
  visibleChildren: (node: TrainableNode) => TrainableNode[];
}

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
          className="ctxmenu-item"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteLine(path);
            hideMenu();
          }}
        >
          <Trash2 />
          Delete from here
        </button>
      ),
    },
    {
      template: () => (
        <button
          type="button"
          className="ctxmenu-item"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startEditing(path);
            hideMenu();
          }}
        >
          <PencilIcon />
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
          className="ctxmenu-item"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startEditing(path);
            hideMenu();
          }}
        >
          <PencilIcon />
          Edit comment
        </button>
      ),
    },
  ];
};

const MAX_LEN_MAINLINE_COMMENT = 300;
const MAX_LEN_INLINE_COMMENT = 200;

/** lichess' `parenthetical`: exactly two continuations, the second one short and straight. */
const isParenthetical = (children: TrainableNode[]): boolean =>
  !children[2] && !!children[1] && !hasBranching(children[1], 6);

// COMMENTS

function truncateComment(text: string, len: number, ctx: Ctx) {
  return ctx.truncateComments && text.length > len ? text.slice(0, len) : text;
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
      className="comment-editor"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={draft}
        maxLength={MAX_COMMENT_CHARS}
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
      />
      <div className="comment-editor-actions">
        <button type="button" onClick={cancel} className="comment-editor-cancel">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={!isDirty} className="comment-editor-save">
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
  const selectedPath = useTrainerStore((s) => s.selectedPath);
  const { showMenu } = useAppContextMenu();
  const items = useCommentContextMenuItems(path);
  const truncated = truncateComment(comment, maxLength, ctx);
  const isTruncated = truncated.length < comment.length;

  const displayText = isTruncated && !expanded ? truncated : comment;
  const isCommentOfActiveMove = path === selectedPath;

  return (
    <span
      className={`comment ${isCommentOfActiveMove ? 'is-current' : ''}`}
      onContextMenu={(e) => showMenu(e, items, path, '')}
    >
      {displayText}
      {isTruncated && (
        <span
          className="comment-expand"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? <ChevronsRightLeftIcon /> : <EllipsisIcon />}
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

export function RenderMainlineCommentsOf({ ctx, node, path }: { ctx: Ctx; node: TrainableNode; path: string }) {
  if (!node.data.comment) return null;

  return (
    <RenderComment comment={node.data.comment} ctx={ctx} path={path} maxLength={MAX_LEN_MAINLINE_COMMENT} />
  );
}

// END COMMENTS

export const plyToTurn = (ply: number): number => Math.floor((ply - 1) / 2) + 1;

export const renderIndex = (ply: number, withDots?: boolean): string =>
  plyToTurn(ply) + (withDots ? (ply % 2 === 1 ? '.' : '...') : '');

/** the move-number gutter cell that opens a mainline row */
function IndexCell({ ply }: { ply: number }) {
  return <div className="index">{renderIndex(ply, false)}</div>;
}

/** placeholder holding a colour's slot so the next move lands in its own column */
function EmptyMove() {
  return <div className="move empty">...</div>;
}

function MoveNode({ node, args }: { node: TrainableNode; args: Args }) {
  const { showMenu, contextSelectedPath } = useAppContextMenu();
  const selectedPath = useTrainerStore((s) => s.selectedPath);
  const { isMainline, parentNode, parenthetical } = args;

  const path = args.parentPath + node.data.id;
  const items = useMoveContextMenuItems(path, node.data);

  // Mainline moves get their number from the gutter cell; sideline moves carry
  // it inline — always for white, and for black whenever the move opens a
  // branch that isn't the first of a parenthesised pair.
  const withIndex =
    !isMainline &&
    (node.data.ply % 2 === 1 ||
      (parentNode.children.length > 1 && (!parenthetical || parentNode.children[0] !== node)));

  const classes = [
    'move',
    isMainline ? '' : 'variation',
    path === selectedPath ? 'active' : '',
    path === contextSelectedPath ? 'is-context-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {withIndex && <span className="index">{renderIndex(node.data.ply, true)}</span>}
      {node.data.san}
    </>
  );
  const onContextMenu = (e: React.MouseEvent) => showMenu(e, items, path, node.data.san);

  return isMainline ? (
    <div data-path={path} className={classes} onContextMenu={onContextMenu}>
      {content}
    </div>
  ) : (
    <span data-path={path} className={classes} onContextMenu={onContextMenu}>
      {content}
    </span>
  );
}

/**
 * A block of sidelines branching off `args.parentNode`. Renders as parentheses
 * when the parent said so, otherwise as a stack of connected `.line` rows.
 */
function Lines({ ctx, nodes, args }: { ctx: Ctx; nodes: TrainableNode[]; args: Args }) {
  if (!nodes.length) return null;

  const lineArgs: Args = {
    parentPath: args.parentPath,
    parentNode: args.parentNode,
    isMainline: false,
  };

  if (!args.isMainline && args.parenthetical)
    return (
      <span className="inline">
        <SidelineNodes ctx={ctx} nodes={nodes} args={lineArgs} />
      </span>
    );

  return (
    <div className={`lines${nodes[1] ? '' : ' single'}`}>
      {nodes.map((n) => (
        <div className="line" key={n.data.id}>
          <div className="branch" />
          <SidelineNodes ctx={ctx} nodes={[n]} args={lineArgs} />
        </div>
      ))}
    </div>
  );
}

/**
 * One sideline: the head move, then its continuation, then its siblings —
 * except when the parent is parenthetical, in which case the siblings come
 * first so they read as `1. e4 (1. d4) 1... e5`.
 */
function SidelineNodes({ ctx, nodes, args }: { ctx: Ctx; nodes: TrainableNode[]; args: Args }) {
  const [child, ...siblings] = nodes;
  if (!child) return null;

  const path = args.parentPath + child.data.id;
  const children = ctx.visibleChildren(child);
  const childArgs: Args = {
    parentPath: path,
    parentNode: child,
    isMainline: false,
    parenthetical: isParenthetical(children),
  };
  const siblingLines = <Lines ctx={ctx} nodes={siblings} args={args} />;

  return (
    <>
      <MoveNode node={child} args={args} />
      <RenderInlineCommentsOf ctx={ctx} node={child} path={path} />
      {args.parenthetical && siblingLines}
      {children.length < 2 || childArgs.parenthetical ? (
        <SidelineNodes ctx={ctx} nodes={children} args={childArgs} />
      ) : (
        <Lines ctx={ctx} nodes={children} args={childArgs} />
      )}
      {!args.parenthetical && siblingLines}
    </>
  );
}

/**
 * The mainline, laid out as a flat run of flex cells. `nodes[0]` continues the
 * mainline; the rest are sidelines that get pushed into an `.interrupt`.
 */
function ColumnNodes({ ctx, nodes, args }: { ctx: Ctx; nodes: TrainableNode[]; args: Args }) {
  const [child, ...siblings] = nodes;
  if (!child) return null;

  const childPath = args.parentPath + child.data.id;
  const isWhite = child.data.ply % 2 === 1;
  const children = ctx.visibleChildren(child);
  const interrupted = siblings.length > 0 || !!child.data.comment;

  return (
    <>
      {isWhite && <IndexCell ply={child.data.ply} />}
      <MoveNode node={child} args={args} />
      {interrupted && (
        <>
          {isWhite && <EmptyMove />}
          <div className="interrupt">
            <RenderMainlineCommentsOf ctx={ctx} node={child} path={childPath} />
            <Lines ctx={ctx} nodes={siblings} args={args} />
          </div>
          {isWhite && children.length > 0 && (
            <>
              <IndexCell ply={child.data.ply} />
              <EmptyMove />
            </>
          )}
        </>
      )}
      <ColumnNodes
        ctx={ctx}
        nodes={children}
        args={{ parentPath: childPath, parentNode: child, isMainline: true }}
      />
    </>
  );
}

function BottomCommentEditor() {
  const { editingPath } = useContext(CommentEditContext);
  const repertoire = useTrainerStore((s) => s.repertoire);
  const selectedChapterId = useTrainerStore((s) => s.selectedChapterId);
  if (editingPath === null) return null;
  const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
  if (!chapter) return null;
  const node = nodeAtPath(chapter.root, editingPath);
  if (!node) return null;

  return (
    <div className="tree-editor-dock">
      <CommentEditor key={editingPath} path={editingPath} initial={node.data.comment ?? ''} />
    </div>
  );
}

function ChildMoveButtons() {
  const jump = useTrainerStore((s) => s.jump);
  const selectedPath = useTrainerStore((s) => s.selectedPath);
  const { repertoire, selectedChapterId } = useTrainerStore.getState();
  const trainingMethod = useTrainerStore.getState().trainingMethod;
  const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
  if (trainingMethod != 'edit' || !chapter) return null;

  const node = selectedPath ? nodeAtPath(chapter.root, selectedPath) : chapter.root;
  if (!node || node.children.length <= 1) return null;

  return (
    <div className="tree-child-moves">
      <div className="tree-child-moves-row">
        {node.children.map((child) => (
          <button
            key={child.data.id}
            className="tree-child-move"
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
  const repertoire = useTrainerStore((s) => s.repertoire);
  const selectedChapterId = useTrainerStore((s) => s.selectedChapterId);
  const trainableContext = useTrainerStore((s) => s.trainableContext);
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
        jump(path);
        break;
      }
      el = el.parentElement!;
    }
  };

  const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
  if (!chapter) return;
  const root = chapter.root;
  if (!root) return;

  // Outside of edit mode only the line being trained is on screen, so children
  // are filtered down to the one that continues it.
  const trainingLine: TrainableNode[] = getNodeList(root, trainableContext?.startingPath || '');
  const visibleChildren = (node: TrainableNode): TrainableNode[] => {
    if (trainingMethod === 'edit') return node.children;
    const ply = node.data.ply;
    if (ply >= trainingLine.length - 1) return [];
    return node.children.filter((c) => c.data.san === trainingLine[ply + 1].data.san);
  };

  const ctx: Ctx = {
    currentPath: '',
    truncateComments: true,
    visibleChildren,
  };

  const blackStarts = (root.data.ply & 1) === 1;

  return (
    <CommentEditContext.Provider value={commentEditValue}>
      <ContextMenuProvider>
        <div className="tree-panel">
          <div
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            className="tview2 tview2-column tree-scroll tree-body"
          >
            {root.data.comment && (
              <div className="interrupt">
                <RenderMainlineCommentsOf ctx={ctx} node={root} path={''} />
              </div>
            )}
            {blackStarts && (
              <>
                <IndexCell ply={root.data.ply} />
                <EmptyMove />
              </>
            )}
            <ColumnNodes
              ctx={ctx}
              nodes={visibleChildren(root)}
              args={{ parentPath: '', parentNode: root, isMainline: true }}
            />
          </div>
          <BottomCommentEditor />
          <ChildMoveButtons />
        </div>
      </ContextMenuProvider>
    </CommentEditContext.Provider>
  );
}
