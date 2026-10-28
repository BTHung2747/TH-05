import { langNgheCuocTroChuyen } from '../src/services/chatService';
import { onValue } from 'firebase/database';
const mockCallbacks = new Map<
  string,
  (snapshot: { exists: () => boolean; val: () => unknown }) => void
>();
const mockStops = new Map<string, jest.Mock>();
jest.mock('../src/services/firebase', () => ({
  getFirebase: () => ({ database: {} }),
}));
jest.mock('firebase/database', () => ({
  ref: (_: unknown, path: string) => ({ path }),
  onValue: jest.fn(
    (target: { path: string }, callback: (snapshot: unknown) => void) => {
      mockCallbacks.set(target.path, callback);
      const stop = jest.fn();
      mockStops.set(target.path, stop);
      return stop;
    },
  ),
}));
const emit = (path: string, value: unknown) =>
  mockCallbacks.get(path)!({ exists: () => value !== null, val: () => value });
beforeEach(() => {
  mockCallbacks.clear();
  mockStops.clear();
  jest.clearAllMocks();
});
test('subscribes once per room, replaces snapshots and unsubscribes removed/all rooms', () => {
  const received = jest.fn();
  const stop = langNgheCuocTroChuyen('a', received, jest.fn());
  emit('userChats/a', { one: 'b', two: 'c' });
  expect(onValue).toHaveBeenCalledTimes(3);
  emit('userChats/a', { one: 'b', two: 'c' });
  expect(onValue).toHaveBeenCalledTimes(3);
  emit('chats/one', { messages: { first: { text: 'hello' } } });
  emit('chats/one', {
    messages: { first: { text: 'hello' }, second: { text: 'world' } },
  });
  expect(Object.keys(received.mock.calls.at(-1)![0].one.messages)).toHaveLength(
    2,
  );
  emit('userChats/a', { one: 'b' });
  expect(mockStops.get('chats/two')).toHaveBeenCalledTimes(1);
  stop();
  expect(mockStops.get('userChats/a')).toHaveBeenCalledTimes(1);
  expect(mockStops.get('chats/one')).toHaveBeenCalledTimes(1);
  expect(mockStops.get('chats/two')).toHaveBeenCalledTimes(1);
});
