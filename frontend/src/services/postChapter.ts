import type { Chapter } from '../types/training';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';

// Sends a chapter_created message over the WebSocket. The server stamps
// the owner from the subscriber's joined room, persists, and broadcasts
// to other subscribers of the same room.
export async function postChapter(chapter: Chapter) {
  const { user } = useAuthStore.getState();
  const { socket, repertoireAuthor } = useTrainerStore.getState();
  if (!user?.sub || !repertoireAuthor) {
    console.error('postChapter: not authenticated or no author');
    return;
  }
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('postChapter: websocket not open');
    return;
  }

  //TODO just send full chapter?
  socket.send(
    JSON.stringify({
      type: 'chapter_created',
      chapterId: chapter.uuid,
      name: chapter.name,
      trainAs: chapter.trainAs,
      root: chapter.root,
      enabledCount: chapter.enabledCount,
      unseenCount: chapter.unseenCount,
    }),
  );
}
