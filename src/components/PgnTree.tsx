import React from 'react';
import { fieldValue } from '../view/view';
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
  <div className="index bg-gray-100 px-5 justify-center flex border-r-2 border-white-500 text-gray-700 basis-[12%]">
    {turn + 1}
  </div>
);

const MoveNode = ({ san, index, pathIndex }: { san: string; index: number, pathIndex: number }) => {
  //TODO actually use this
  const correctMoveIndices = [];
  //TODO add back jump

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
  trainingPath,
}: {
  text: string;
  nodeNumber: number;
  commentNumber: number;
  trainingPath: any; // TODO have a type file for this
}) => {
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

const RowNode = ({ children }) => (
  <div id="move-row" className="flex">
    {children}
  </div>
);

const PgnControls = ({ trainingPath, pathIndex, jump }) => {
  let atLast = pathIndex === trainingPath.length - 2;

  return (
    <div id="pgn-control" className="flex justify-center w-full mt-3">
      <button onClick={() => jump(0)}>{<ChevronFirst />}</button>
      <button onClick={() => jump(Math.max(0, pathIndex - 1))}>{<ChevronLeft />}</button>
      <button onClick={() => jump(Math.min(trainingPath.length - 2, pathIndex + 1))}>
        {<ChevronRight />}
      </button>
      <button onClick={() => jump(trainingPath.length - 2)} className={!atLast ? 'animate-pulse-blue' : ''}>
        {<ChevronLast />}
      </button>
    </div>
  );
};

export const PgnTree = ({ trainingPath, pathIndex, jump }) => {
  const rows: React.ReactNode[] = [];
  let elms: React.ReactNode[] = [];
  let ply = 0;
  for (let i = 0; i < trainingPath.length - 1; i++) {
    const node = trainingPath[i];
    const even = i % 2 === 0;

    if (even) elms.push(<IndexNode key={`idx-${i}`} turn={Math.floor(ply / 2)} />);
    elms.push(<MoveNode key={`mv-${i}`} san={node.data.san!} index={i} pathIndex={pathIndex} />);
    ply++;

    const addEmpty = even && node.data.comments?.length;
    if (addEmpty) elms.push(<EmptyNode key={`empty-${i}`} />);
    node.data.comments?.forEach((comment, j) => {
      elms.push(<CommentNode key={`cmt-${i}-${j}`} text={comment} nodeNumber={i} commentNumber={j} trainingPath={trainingPath} />);
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

  const addComment = () => {
    const comment = fieldValue('comment-input');
    const node = trainingPath[pathIndex];
    if (!node.data.comments) node.data.comments = [];
    node.data.comments.push(comment);
  };

  return (
    <div>
      <div id="pgn_side" className="h-1/3 flex flex-col shadow-md rounded-t-lg bg-white">
        <div id="moves" className="overflow-auto h-80">
          {rows}
        </div>
      </div>
      <PgnControls trainingPath={trainingPath} pathIndex={pathIndex} jump={jump} />
      <div id="add-comment-wrap" className="flex flex-col items-start">
        <textarea id="comment-input" className="w-full h-32 rounded-md shadow-md bg-stone-100" />
        <button
          onClick={addComment}
          className="flex bg-blue-500 text-white font-semibold rounded-md p-2 rounded-tl-lg gap-1 px-5 hover:bg-blue-600 active:scale-95 shadow-md hover:shadow-lg"
        >
          <div>{<MessageSquarePlus />}</div>
          <div>Add Comment</div>
        </button>
      </div>
    </div>
  );
};
