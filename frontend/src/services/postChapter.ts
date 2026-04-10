import type { Chapter } from '../types/training';
import { useAuthStore } from '../state/auth';

// TODO make websocket operation 
export async function postChapter(chapter: Chapter) {
  const { user, repertoireId } = useAuthStore.getState();
  if (!user?.sub || !repertoireId) {
    console.error('postChapter: not authenticated or no repertoire');
    return;
  }

  const res = await fetch('http://localhost:8080/chapter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'chapter_created',
      chapterId: chapter.uuid,
      repertoireId,
      name: chapter.name,
      trainAs: chapter.trainAs,
      root: chapter.root
    }),
  });

  if (!res.ok) {
    console.error('postChapter failed', res.status, await res.text());
  }
}
