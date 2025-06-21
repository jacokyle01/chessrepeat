import React from 'react';
// import { backI, firstI, lastI, nextI, commentI, trashI, clipboardI, addCommentI } from '../svg';
import { useTrainerStore } from '../../state/state';
import { fieldValue } from '../../view/view';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  MessageSquareText,
  SkipForward,
  Trash2Icon,
} from 'lucide-react';

const IndexNode = ({ turn }: { turn: number }) => (
  <div className="index bg-gray-100 px-5 justify-center flex border-r-2 border-white-500 text-gray-700 basis-[13%]">
    {turn + 1}
  </div>
);

const MoveNode = ({ san, index }: { san: string; index: number }) => {
  const pathIndex = useTrainerStore((s) => s.pathIndex);

  //TODO actually use this
  const correctMoveIndices = [];
  //TODO add back jump
  // const jump = useTrainerStore((s) => s.jump);

  const isCorrect = correctMoveIndices.includes(index);
  const isActive = pathIndex === index;

  const baseClass = 'hover:cursor-pointer text-lg pl-2 basis-[44%]';
  const activeClass = isCorrect ? 'text-green-600 flex justify-between items-center' : 'text-gray-700';
  const bgClass = isCorrect
    ? isActive
      ? 'bg-green-300 font-bold'
      : 'hover:bg-green-100'
    : isActive
      ? 'bg-sky-300 font-bold'
      : 'hover:bg-sky-100';

  return (
    // <div className={`${baseClass} ${activeClass} ${bgClass}`} onClick={() => jump(index)}>

    <div className={`${baseClass} ${activeClass} ${bgClass}`}>
      <span>{san}</span>
      {isCorrect && <span className="text-xl">✓</span>}
    </div>
  );
};

const EmptyNode = () => (
  <div className="move flex-1 hover:cursor-pointer text-lg basis-[44%] pl-2 text-gray-700">...</div>
);

const CommentNode = ({
  text,
  nodeNumber,
  commentNumber,
}: {
  text: string;
  nodeNumber: number;
  commentNumber: number;
}) => {
  const trainingPath = useTrainerStore((s) => s.trainingPath);

  const handleDelete = () => {
    const comments = trainingPath[nodeNumber]?.data?.comments;
    if (comments) {
      comments.splice(commentNumber, 1);
    }
  };

  return (
    <div className="comment flex border-y-2 border-white-500">
      <div className="comment-icons flex flex-col bg-gray-100">
        <div className="index bg-gray-100 px-5 justify-center flex w-8 p-1">{<MessageSquareText />}</div>
        <div className="index bg-gray-100 px-5 justify-center flex w-8 p-1" onClick={handleDelete}>
          {<Trash2Icon />}
        </div>
      </div>
      <div className="bg-gray-100 text-md flex items-center font-mono w-full">{text}</div>
    </div>
  );
};

const RowNode = ({ children }: { children: React.ReactNode }) => (
  <div id="move-row" className="flex">
    {children}
  </div>
);

export interface PgnTreeProps {
  // repertoire: RepertoireEntry[];
  jump: (index: number) => void;

  //TODO calculate this dynamically??
}

export const PgnTree: React.FC<PgnTreeProps> = ({ jump }) => {
  // const trainingPath = useTrainerStore((s) => s.trainingPath);
  // const pathIndex = useTrainerStore((s) => s.pathIndex);
  // const redraw = useTrainerStore((s) => s.redraw);
  const trainingPath = useTrainerStore.getState().trainingPath;
  const pathIndex = useTrainerStore.getState().pathIndex;

  const rows: React.ReactNode[] = [];
  let elms: React.ReactNode[] = [];
  let ply = 0;
  for (let i = 0; i < trainingPath.length - 1; i++) {
    const node = trainingPath[i];
    const even = i % 2 === 0;

    if (even) elms.push(<IndexNode key={`idx-${i}`} turn={Math.floor(ply / 2)} />);
    elms.push(<MoveNode key={`mv-${i}`} san={node.data.san!} index={i} />);
    ply++;

    const addEmpty = even && node.data.comments?.length;
    if (addEmpty) elms.push(<EmptyNode key={`empty-${i}`} />);
    node.data.comments?.forEach((comment, j) => {
      elms.push(<CommentNode key={`cmt-${i}-${j}`} text={comment} nodeNumber={i} commentNumber={j} />);
    });
    if (addEmpty) {
      elms.push(<IndexNode key={`idx2-${i}`} turn={Math.floor(ply / 2)} />);
      elms.push(<EmptyNode key={`empty2-${i}`} />);
    }
  }

  for (let i = 0; i < elms.length; ) {
    const maybeComment = elms[i];
    if (React.isValidElement(maybeComment) && maybeComment.props?.className?.includes('comment')) {
      rows.push(maybeComment);
      i += 1;
    } else {
      rows.push(<RowNode key={`row-${i}`}>{elms.slice(i, i + 3)}</RowNode>);
      i += 3;
    }
  }

  return (
    <div className='bg-white flex-1 h-full border border-gray-300 gap-5 rounded-t-xl'>
      <div id="pgn_side" className="flex flex-col">
        <div id="moves" className="overflow-auto h-80">
          {rows}
        </div>
      </div>
    </div>
  );
};
