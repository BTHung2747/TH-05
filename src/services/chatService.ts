import {
  get,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { getFirebase } from './firebase';
import { conversationId, type RemoteChat } from './chatModel';

export const moCuocTroChuyen = async (uid: string, peerId: string) => {
  const { database } = getFirebase();
  const id = conversationId(uid, peerId);
  const [participantA, participantB] = [uid, peerId].sort();
  const chatRef = ref(database, `chats/${id}`);
  if (!(await get(chatRef)).exists()) {
    try {
      await set(chatRef, {
        participantA,
        participantB,
        members: { [uid]: true, [peerId]: true },
      });
    } catch (error) {
      // Creation is create-only in Rules. A simultaneous creator must never
      // overwrite messages; accept the existing room only if both are members.
      const existing = (await get(chatRef)).val() as RemoteChat | null;
      if (!existing?.members[uid] || !existing.members[peerId]) throw error;
    }
  }
  await update(ref(database), {
    [`userChats/${uid}/${id}`]: peerId,
    [`userChats/${peerId}/${id}`]: uid,
  });
  return id;
};

export const langNgheCuocTroChuyen = (
  uid: string,
  onChats: (chats: Record<string, RemoteChat>) => void,
  onError: (error: Error) => void,
) => {
  const { database } = getFirebase();
  const subscriptions = new Map<string, () => void>();
  const chats: Record<string, RemoteChat> = {};
  const stop = onValue(
    ref(database, `userChats/${uid}`),
    snapshot => {
      const ids = new Set(Object.keys(snapshot.val() || {}));
      subscriptions.forEach((unsubscribe, id) => {
        if (!ids.has(id)) {
          unsubscribe();
          subscriptions.delete(id);
          delete chats[id];
        }
      });
      ids.forEach(id => {
        if (subscriptions.has(id)) return;
        subscriptions.set(
          id,
          onValue(
            ref(database, `chats/${id}`),
            chat => {
              if (chat.exists()) chats[id] = chat.val();
              else delete chats[id];
              onChats({ ...chats });
            },
            onError,
          ),
        );
      });
      onChats({ ...chats });
    },
    onError,
  );
  return () => {
    stop();
    subscriptions.forEach(unsubscribe => unsubscribe());
    subscriptions.clear();
  };
};

export const guiTinFirebase = async (
  id: string,
  uid: string,
  text: string,
  location?: { latitude: number; longitude: number },
) => {
  if (!location && !text.trim())
    throw new Error('Không thể gửi tin nhắn trống.');
  const message = push(ref(getFirebase().database, `chats/${id}/messages`));
  await set(message, {
    senderId: uid,
    text: location ? '📍 Vị trí hiện tại' : text.trim(),
    type: location ? 'location' : 'text',
    createdAt: serverTimestamp(),
    ...(location || {}),
  });
};

export const danhDauDaDoc = (id: string, uid: string, key: string) =>
  set(ref(getFirebase().database, `chats/${id}/reads/${uid}`), key);
