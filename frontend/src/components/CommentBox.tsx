import { useTrainerStore } from '../state/state';

export const CommentBox = () => {
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const comment = (selectedNode as any)?.data?.comment;

  if (!comment) return null;

  return (
    <div className="px-3 py-2 text-sm text-blue-700 bg-blue-50 rounded-md ring-1 ring-blue-200">
      {comment}
    </div>
  );
};
