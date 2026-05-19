import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';
import { reloadRepertoire } from '../services/repertoire';

const WS_URL = import.meta.env.VITE_API_URL.replace(/^http/, 'ws');

// Owns the /repertoire fetch and the WebSocket lifecycle. Two phases:
//
//   1. Bootstrap (mount): call GET /repertoire (session-resolved). On 200 we
//      learn who the session belongs to, hydrate auth + chapters, and default
//      repertoireOwner to the signed-in user's own username. On 401 we fall
//      through to playground mode (IDB).
//   2. Owner switching: whenever repertoireOwner changes after bootstrap,
//      re-fetch chapters and re-open the WebSocket room.

//watch for changes in `repertoireOwner`, start websocket session automatically.
//TODO more detailed about connection ..?
export function useWebsocket() {
  const repertoireAuthor = useTrainerStore().repertoireAuthor;

  const {
    setWebSocket,
    setConnectedUsers,
    addConnectedUser,
    removeConnectedUser,
    addMove,
    deleteNodeRemote,
    disableNodeRemote,
    enableNodeRemote,
    updateTrainingRemote,
    deleteChapterRemote,
  } = useTrainerStore();

  useEffect(() => {
    if (!repertoireAuthor) return;
    const ws = new WebSocket(`${WS_URL}/subscribe/${repertoireAuthor}`);
    setWebSocket(ws);
    ws.onopen = () => console.log('ws live');
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      switch (payload.type) {
        case 'crowd':
          setConnectedUsers(payload.users);
          break;
        case 'user_joined':
          addConnectedUser(payload.user);
          break;
        case 'user_left':
          removeConnectedUser(payload.user.username);
          break;
        case 'move_created':
          addMove(payload.chapterId, payload.path, { data: payload.move, children: [] });
          break;
        case 'reload':
          // Server rejected one of our mutations because it targeted a
          // path it doesn't have — our tree drifted. Resync over HTTP.
          void reloadRepertoire();
          break;
        case 'node_deleted':
          deleteNodeRemote(payload.chapterId, payload.path);
          break;
        case 'node_disabled':
          disableNodeRemote(payload.chapterId, payload.path);
          break;
        case 'node_enabled':
          enableNodeRemote(payload.chapterId, payload.path);
          break;
        case 'training_updated':
          updateTrainingRemote(payload.chapterId, payload.path, payload.username, payload.card);
          break;
        case 'chapter_deleted':
          deleteChapterRemote(payload.chapterId);
          break;
        // No 'chapter_created' case: chapters are created via HTTP POST
        // /chapter, after which the server broadcasts 'reload' to the
        // room and every peer resyncs via reloadRepertoire above.
      }
    };
    return () => {
      ws.close();
      setConnectedUsers([]);
    };
  }, [repertoireAuthor]);
}
