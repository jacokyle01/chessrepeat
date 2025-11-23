import { ClipboardCopy, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { useTrainerStore } from '../state/state';

export const CopyFen = () => {
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const [copied, setCopied] = useState(false);

  if (!selectedNode) return null;

  const fen = selectedNode.fen;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fen);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200); // revert icon after 1.2s
  };

  return (
    <div
      className="
        flex items-center gap-2 max-w-full 
        px-3 py-2 rounded-lg 
        bg-gray-100 border border-gray-300 
        text-sm font-mono text-gray-800
      "
    >
      {/* FEN with ellipsis */}
      <span
        className="
          whitespace-nowrap overflow-hidden overflow-ellipsis 
          max-w-[240px] sm:max-w-[300px] md:max-w-[350px]
        "
        title={fen} // show full FEN on hover
      >
        {fen}
      </span>

      {/* Copy icon button */}
      <button
        onClick={handleCopy}
        className="
          p-1 rounded-md
          hover:bg-gray-200 active:bg-gray-300
          transition-colors 
          text-gray-600 hover:text-gray-800
        "
      >
        {copied ? (
          <ClipboardCheck className="w-4 h-4 text-green-600" />
        ) : (
          <ClipboardCopy className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};
