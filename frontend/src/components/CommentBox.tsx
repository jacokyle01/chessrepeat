import { useTrainerStore } from '../store/state';
import './CommentBox.css';

export const CommentBox = () => {
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const comment = (selectedNode as any)?.data?.comment;

  if (!comment) return null;

  return (
    <div className="comment-box">{comment}</div>
  );
};
