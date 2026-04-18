import { useState } from 'react';
import { PLAYGROUND_SUB, useAuthStore } from '../../state/auth';
import { clearPlaygroundIDB, loadPlaygroundChapters, useTrainerStore } from '../../state/state';
import { postChapter } from '../../services/postChapter';
import { forEachNode } from '../../util/tree';
import type { Chapter } from '../../types/training';

function rekeyTraining(chapters: Chapter[], newSub: string): Chapter[] {
  for (const chapter of chapters) {
    forEachNode(chapter.root, (node) => {
      const card = node.data.training?.[PLAYGROUND_SUB];
      if (card) {
        node.data.training[newSub] = card;
        delete node.data.training[PLAYGROUND_SUB];
      }
    });
  }
  return chapters;
}

interface Props {
  onClose: () => void;
}

export function MigrationModal({ onClose }: Props) {
  const [migrating, setMigrating] = useState(false);

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const sub = useAuthStore.getState().user?.sub;
      if (!sub) return;

      const chapters = await loadPlaygroundChapters();
      rekeyTraining(chapters, sub);

      // Add each chapter to the store and send to server
      const { addNewChapterLocally } = useTrainerStore.getState();
      for (const chapter of chapters) {
        await addNewChapterLocally(chapter);
        await postChapter(chapter);
      }

      await clearPlaygroundIDB();
    } catch (err) {
      console.error('migration failed', err);
    } finally {
      setMigrating(false);
      onClose();
    }
  };

  const handleDiscard = async () => {
    await clearPlaygroundIDB();
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-96">
        <h2 className="text-lg font-semibold mb-2">Migrate Playground Repertoire</h2>
        <p className="text-sm text-gray-600 mb-4">
          You have repertoire data from playground mode. Would you like to migrate it to your account?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={migrating}
            className="px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleMigrate}
            disabled={migrating}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {migrating ? 'Migrating...' : 'Migrate'}
          </button>
        </div>
      </div>
    </div>
  );
}
