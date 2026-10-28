export interface RemoteMessage {
  senderId: string;
  text: string;
  createdAt: number;
  type: 'text' | 'location';
  latitude?: number;
  longitude?: number;
}
export interface RemoteChat {
  participantA: string;
  participantB: string;
  members: Record<string, boolean>;
  messages?: Record<string, RemoteMessage>;
  reads?: Record<string, string>;
}
export const conversationId = (a: string, b: string) => {
  if (!a || !b || a === b) throw new Error('Cần hai người dùng khác nhau.');
  return [a, b].sort().join('_');
};
export const sortedMessages = (chat: RemoteChat) =>
  Object.entries(chat.messages || {}).sort(
    ([a, first], [b, second]) =>
      first.createdAt - second.createdAt || (a < b ? -1 : a > b ? 1 : 0),
  );

export const unreadCount = (chat: RemoteChat, uid: string) => {
  const readKey = chat.reads?.[uid] || '';
  const messages = sortedMessages(chat);
  const readIndex = messages.findIndex(([key]) => key === readKey);
  return messages.filter(
    ([, message], index) => message.senderId !== uid && index > readIndex,
  ).length;
};
export const mapUrl = (latitude: number, longitude: number) => {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error('Tọa độ vị trí không hợp lệ.');
  }
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
};
