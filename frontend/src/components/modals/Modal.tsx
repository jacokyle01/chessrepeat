//TODO use modal in framework? 

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Tailwind z-index class; override to stack above another open modal. */
  zClassName?: string;
}> = ({ open, onClose, title, children, zClassName = 'z-50' }) => {
  if (!open) return null;
  return (
    <div className={`fixed inset-0 flex items-center justify-center bg-black/25 ${zClassName}`}>
      <div className="bg-white rounded-xl shadow-lg p-6 w-96 relative">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <div>{children}</div>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800">
          ✕
        </button>
      </div>
    </div>
  );
};