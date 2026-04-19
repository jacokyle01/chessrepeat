import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';

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
    addNewChapterLocally,
    deleteNodeRemote,
    disableNodeRemote,
    enableNodeRemote,
    updateTrainingRemote,
  } = useTrainerStore();

  useEffect(() => {
    if (!repertoireAuthor) return;
    const ws = new WebSocket(`ws://localhost:8080/subscribe/${repertoireAuthor}`);
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
          removeConnectedUser(payload.user.userId);
          break;
        case 'move_created':
          addMove(payload.chapterId, payload.path, { data: payload.move, children: [] });
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
          updateTrainingRemote(payload.chapterId, payload.path, payload.userSub, payload.card);
          break;
        case 'chapter_created':
          addNewChapterLocally({
            uuid: payload.chapterId,
            name: payload.name,
            trainAs: payload.trainAs,
            root: {
              data: {
                id: '',
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                ply: 0,
                san: '',
                comment: '',
                enabled: false,
                training: {},
              },
              children: [],
            },
            enabledCount: payload.enabledCount,
            unseenCount: payload.enabledCount,
            lastDueCount: 0,
          });
          break;
      }
    };
    return () => {
      ws.close();
      setConnectedUsers([]);
    };
  }, [repertoireAuthor]);
}
