//TODO use modal in framework?

import './Modal.css';

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** extra class on the scrim; use `is-stacked` to sit above another open modal. */
  scrimClassName?: string;
}> = ({ open, onClose, title, children, scrimClassName = '' }) => {
  if (!open) return null;
  return (
    <div className={`simple-modal-scrim ${scrimClassName}`}>
      <div className="simple-modal-card">
        <h2>{title}</h2>
        <div>{children}</div>
        <button onClick={onClose} className="simple-modal-close">
          ✕
        </button>
      </div>
    </div>
  );
};
