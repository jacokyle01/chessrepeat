import React, { useState } from 'react';
import { DownloadIcon, XIcon } from 'lucide-react';
import { useTrainerStore } from '../../store/state';
import { pgnFromChapter, pgnFromRepertoire } from '../../util/training';
import { downloadTextFile, repertoireAsJson } from '../../util/io';
import './modals.css';
import './DownloadModal.css';

type DownloadScope = 'repertoire' | 'chapter';
type ExportFormat = 'json' | 'pgn';

const DownloadModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const repertoire = useTrainerStore((state) => state.repertoire);
  const selectedChapterId = useTrainerStore((state) => state.selectedChapterId);
  const chapter = repertoire.find((c) => c.uuid === selectedChapterId);

  const [scope, setScope] = useState<DownloadScope>('repertoire');
  const [format, setFormat] = useState<ExportFormat>('json');

  const canDownloadChapter = !!chapter;
  const canDownloadRepertoire = repertoire.length > 0;
  const canDownload = scope === 'repertoire' ? canDownloadRepertoire : canDownloadChapter;

  const download = () => {
    if (!canDownload) return;

    if (scope === 'chapter' && chapter) {
      if (format === 'pgn') {
        downloadTextFile(pgnFromChapter(chapter), `${chapter.name}.pgn`, 'application/x-chess-pgn');
      } else {
        downloadTextFile(repertoireAsJson([chapter]), `${chapter.name}.json`, 'application/json');
      }
    } else if (scope === 'repertoire') {
      if (format === 'pgn') {
        downloadTextFile(pgnFromRepertoire(repertoire), 'repertoire.pgn', 'application/x-chess-pgn');
      } else {
        downloadTextFile(repertoireAsJson(repertoire), 'repertoire.json', 'application/json');
      }
    }

    onClose();
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card-header">
          <h2>Download</h2>
          <button type="button" onClick={onClose} className="modal-close-x">
            <XIcon size={18} />
          </button>
        </div>

        <div className="modal-card-body">
          <fieldset>
            <legend className="modal-section-label">Scope</legend>
            <div className="download-options">
              <ScopeOption
                label="Repertoire"
                sublabel={`${repertoire.length} chapter${repertoire.length !== 1 ? 's' : ''}`}
                selected={scope === 'repertoire'}
                disabled={!canDownloadRepertoire}
                onClick={() => setScope('repertoire')}
              />
              <ScopeOption
                label="Chapter"
                sublabel={chapter?.name || 'none'}
                selected={scope === 'chapter'}
                disabled={!canDownloadChapter}
                onClick={() => setScope('chapter')}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="modal-section-label">Format</legend>
            <div className="download-options">
              <FormatOption
                label="JSON"
                sublabel="Chessrepeat format"
                selected={format === 'json'}
                onClick={() => setFormat('json')}
              />
              <FormatOption
                label="PGN"
                sublabel="Standard chess"
                selected={format === 'pgn'}
                onClick={() => setFormat('pgn')}
              />
            </div>
          </fieldset>

          <button
            onClick={download}
            type="button"
            disabled={!canDownload}
            className="download-submit"
          >
            <DownloadIcon />
            Download {scope === 'chapter' ? 'Chapter' : 'Repertoire'} as .{format}
          </button>
        </div>
      </div>
    </div>
  );
};

const ScopeOption: React.FC<{
  label: string;
  sublabel: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ label, sublabel, selected, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`download-option ${selected ? 'is-selected' : ''}`}
  >
    <div className="download-option-label">{label}</div>
    <div className="download-option-sublabel">{sublabel}</div>
  </button>
);

const FormatOption: React.FC<{
  label: string;
  sublabel: string;
  selected: boolean;
  onClick: () => void;
}> = ({ label, sublabel, selected, onClick }) => (
  <button type="button" onClick={onClick} className={`download-option ${selected ? 'is-selected' : ''}`}>
    <div className="download-option-label">{label}</div>
    <div className="download-option-sublabel">{sublabel}</div>
  </button>
);

export default DownloadModal;
