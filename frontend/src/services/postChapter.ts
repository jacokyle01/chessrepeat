import type { Chapter } from '../types/training';
import { useAuthStore } from '../state/auth';
import { useTrainerStore } from '../state/state';

// Sends a chapter_created message over the WebSocket. The server matches
// the `type` field to its create-chapter action, persists, and broadcasts
// to other subscribers of the repertoire.
export async function postChapter(chapter: Chapter) {
  const { user, repertoireId } = useAuthStore.getState();
  if (!user?.sub || !repertoireId) {
    console.error('postChapter: not authenticated or no repertoire');
    return;
  }

  const { socket } = useTrainerStore.getState();
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('postChapter: websocket not open');
    return;
  }

  //TODO just send full chapter? 
  socket.send(
    JSON.stringify({
      type: 'chapter_created',
      chapterId: chapter.uuid,
      repertoireId,
      name: chapter.name,
      trainAs: chapter.trainAs,
      root: chapter.root,
      enabledCount: chapter.enabledCount,
      unseenCount: chapter.unseenCount,
    }),
  );
}
