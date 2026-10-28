import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { avatars } from '../assets/avatars';
import { thongBaoMau } from '../data/thongBao';
import type { TrangThaiChat, TaiKhoan } from '../types';
import { firebaseDaCauHinh, loiFirebase } from '../../services/firebase';
import {
  langNgheTaiKhoan,
  dangKyFirebase,
  dangNhapFirebase,
  dangXuatFirebase,
} from '../../services/authService';
import {
  danhDauDaDoc,
  guiTinFirebase,
  langNgheCuocTroChuyen,
  moCuocTroChuyen,
} from '../../services/chatService';
import {
  sortedMessages,
  unreadCount,
  type RemoteChat,
} from '../../services/chatModel';
import { batTrangThaiOnline } from '../../services/presenceService';
import { layViTriHienTai } from '../../services/locationService';
import { langNgheDanhBa } from '../../services/userService';

interface ChatContextValue extends TrangThaiChat {
  loading: boolean;
  error: string;
  dangNhap: (email: string, password: string) => Promise<boolean>;
  dangKy: (name: string, email: string, password: string) => Promise<boolean>;
  dangXuat: () => Promise<void>;
  moChat: (uid: string) => Promise<string>;
  docChat: (id: string) => void;
  dongChat: (id: string) => void;
  guiTin: (id: string, text: string) => Promise<boolean>;
  guiViTri: (id: string) => Promise<boolean>;
  docThongBao: (id: string) => void;
  docTatCaThongBao: () => void;
  doiOnline: (online: boolean) => void;
  doiBadge: (badge: boolean) => void;
  moDuAnCu?: () => void;
}
const ChatContext = createContext<ChatContextValue | null>(null);
export const ChatProvider = ({
  children,
  moDuAnCu,
}: PropsWithChildren<{ moDuAnCu?: () => void }>) => {
  const [taiKhoan, setTaiKhoan] = useState<TaiKhoan | null>(null);
  const [nguoiDung, setNguoiDung] = useState<TrangThaiChat['nguoiDung']>([]);
  const [remoteChats, setRemoteChats] = useState<Record<string, RemoteChat>>(
    {},
  );
  const [thongBao, setThongBao] = useState(() =>
    thongBaoMau.map(item => ({ ...item })),
  );
  const [hienThiOnline, doiOnline] = useState(true);
  const [hienThiBadge, doiBadge] = useState(true);
  const [loading, setLoading] = useState(firebaseDaCauHinh());
  const [error, setError] = useState('');
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );
  const activeChat = useRef<string | null>(null);
  const presenceStop = useRef<(() => Promise<void>) | null>(null);
  const readRequests = useRef(new Map<string, string>());
  const uid = taiKhoan?.id;
  const reportError = (cause: unknown) => setError(loiFirebase(cause));

  useEffect(() => {
    if (!firebaseDaCauHinh()) {
      setError('Chưa cấu hình Firebase trong src/services/firebaseConfig.ts.');
      return;
    }
    return langNgheTaiKhoan(
      user => {
        setError('');
        setLoading(false);
        setTaiKhoan(
          user
            ? {
                id: user.uid,
                taiKhoan: user.email || '',
                tenHienThi:
                  user.displayName || user.email?.split('@')[0] || 'Bạn',
                avatar: avatars.me,
              }
            : null,
        );
        if (!user) {
          setNguoiDung([]);
          setRemoteChats({});
          activeChat.current = null;
          readRequests.current.clear();
          setThongBao(thongBaoMau.map(item => ({ ...item })));
          doiOnline(true);
          doiBadge(true);
        }
      },
      cause => {
        reportError(cause);
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next =>
      setForeground(next === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const stopUsers = langNgheDanhBa(
      uid,
      danhBa => {
        if (alive)
          setNguoiDung(
            danhBa.map(nguoi => ({
              ...nguoi,
              tenNgan: nguoi.ten.split(' ').pop() || nguoi.ten,
              avatar: avatars.an,
            })),
          );
      },
      ten => {
        if (alive)
          setTaiKhoan(current =>
            current?.id === uid ? { ...current, tenHienThi: ten } : current,
          );
      },
      reportError,
    );
    const stopChats = langNgheCuocTroChuyen(
      uid,
      chats => {
        if (alive) setRemoteChats(chats);
      },
      reportError,
    );
    return () => {
      alive = false;
      stopUsers();
      stopChats();
    };
  }, [uid]);

  useEffect(() => {
    if (uid && foreground && hienThiOnline) {
      const stop = batTrangThaiOnline(uid, reportError);
      presenceStop.current = stop;
      return () => {
        if (presenceStop.current === stop) presenceStop.current = null;
        stop().catch(reportError);
      };
    }
  }, [uid, foreground, hienThiOnline]);

  const markRead = useCallback(
    (id: string) => {
      if (!uid) return;
      const chat = remoteChats[id];
      const last = chat && sortedMessages(chat).pop()?.[0];
      if (
        !last ||
        chat.reads?.[uid] === last ||
        readRequests.current.get(id) === last
      )
        return;
      readRequests.current.set(id, last);
      danhDauDaDoc(id, uid, last)
        .catch(reportError)
        .finally(() => {
          if (readRequests.current.get(id) === last)
            readRequests.current.delete(id);
        });
    },
    [uid, remoteChats],
  );
  useEffect(() => {
    if (activeChat.current && foreground) markRead(activeChat.current);
  }, [markRead, foreground]);

  const tinNhan: TrangThaiChat['tinNhan'] = {};
  const troChuyen = Object.entries(remoteChats)
    .map(([id, chat]) => {
      tinNhan[id] = sortedMessages(chat).map(([key, message]) => ({
        id: key,
        troChuyenId: id,
        nguoiGuiId: message.senderId === uid ? 'me' : message.senderId,
        noiDung: message.text,
        thoiGian: message.createdAt,
        ...(message.type === 'location'
          ? {
              viTri: {
                latitude: message.latitude!,
                longitude: message.longitude!,
              },
            }
          : {}),
      }));
      return {
        id,
        nguoiDungId:
          chat.participantA === uid ? chat.participantB : chat.participantA,
        soChuaDoc: uid ? unreadCount(chat, uid) : 0,
      };
    })
    .sort(
      (a, b) =>
        (tinNhan[b.id].at(-1)?.thoiGian || 0) -
        (tinNhan[a.id].at(-1)?.thoiGian || 0),
    );

  const authenticate = async (action: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try {
      await action();
      return true;
    } catch (cause) {
      reportError(cause);
      return false;
    } finally {
      setLoading(false);
    }
  };
  const value: ChatContextValue = {
    taiKhoan,
    nguoiDung,
    troChuyen,
    tinNhan,
    thongBao,
    hienThiOnline,
    hienThiBadge,
    loading,
    error,
    moDuAnCu,
    dangNhap: (email, password) =>
      authenticate(() => dangNhapFirebase(email, password)),
    dangKy: (name, email, password) =>
      authenticate(() => dangKyFirebase(name, email, password)),
    dangXuat: async () => {
      try {
        // Presence must be removed while the user still has write permission.
        await presenceStop.current?.();
        await dangXuatFirebase();
      } catch (cause) {
        reportError(cause);
      }
    },
    moChat: async peer => {
      if (!uid) throw new Error('Vui lòng đăng nhập.');
      return moCuocTroChuyen(uid, peer);
    },
    docChat: id => {
      activeChat.current = id;
      markRead(id);
    },
    dongChat: id => {
      if (activeChat.current === id) activeChat.current = null;
    },
    guiTin: async (id, text) => {
      if (!uid || !text.trim()) return false;
      try {
        await guiTinFirebase(id, uid, text);
        return true;
      } catch (cause) {
        reportError(cause);
        return false;
      }
    },
    guiViTri: async id => {
      if (!uid) return false;
      try {
        const location = await layViTriHienTai();
        await guiTinFirebase(id, uid, '', location);
        return true;
      } catch (cause) {
        reportError(cause);
        throw cause;
      }
    },
    docThongBao: id =>
      setThongBao(items =>
        items.map(item => (item.id === id ? { ...item, daDoc: true } : item)),
      ),
    docTatCaThongBao: () =>
      setThongBao(items => items.map(item => ({ ...item, daDoc: true }))),
    doiOnline,
    doiBadge,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat phải được dùng trong ChatProvider.');
  return context;
};
