import {
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
} from 'firebase/database';
import { getFirebase } from './firebase';

export const batTrangThaiOnline = (
  uid: string,
  onError: (error: Error) => void,
) => {
  const { database } = getFirebase();
  let active = true;
  let stopping: Promise<void> | undefined;
  const connections = new Set<ReturnType<typeof push>>();
  const stop = onValue(
    ref(database, '.info/connected'),
    snapshot => {
      if (snapshot.val() !== true) return;
      const connection = push(ref(database, `presence/${uid}/connections`));
      connections.add(connection);
      const disconnect = onDisconnect(connection);
      disconnect
        .remove()
        .then(async () => {
          if (!active) {
            await disconnect.cancel();
            return;
          }
          await set(connection, true);
          if (!active) {
            await remove(connection);
            await disconnect.cancel();
          }
        })
        .catch(onError);
      onDisconnect(ref(database, `presence/${uid}/lastOnline`))
        .set(serverTimestamp())
        .catch(onError);
    },
    onError,
  );
  return () => {
    if (stopping) return stopping;
    active = false;
    stop();
    // Remove only this device's connections; other signed-in devices stay online.
    stopping = Promise.all(
      Array.from(connections, async connection => {
        await remove(connection);
        await onDisconnect(connection).cancel();
      }),
    ).then(() => undefined);
    return stopping;
  };
};
