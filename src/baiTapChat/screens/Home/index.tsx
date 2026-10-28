import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Keyboard, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ChatTabScreenProps } from '../../navigation/types';
import { HangTroChuyen } from '../../components/HangTroChuyen';
import { NguoiTrucTuyen } from '../../components/NguoiTrucTuyen';
import { ThanhTimKiem } from '../../components/ThanhTimKiem';
import { TieuDeManHinh, TrangRong } from '../../components/common';
import { useChat } from '../../state/ChatContext';
import { khopTimKiem } from '../../utils/timKiem';
import { thoiGianTroChuyen } from '../../utils/thoiGian';
import { styles } from './styles';

export const HomeChat = ({ navigation }: ChatTabScreenProps<'Home'>) => {
  const chat = useChat();
  const [query, setQuery] = useState('');
  const items = useMemo(
    () =>
      chat.troChuyen
        .filter(item =>
          chat.nguoiDung.some(person => person.id === item.nguoiDungId),
        )
        .map(item => {
          const user = chat.nguoiDung.find(
            person => person.id === item.nguoiDungId,
          )!;
          const messages = chat.tinNhan[item.id] || [];
          const last = messages[messages.length - 1];
          const sender =
            last?.nguoiGuiId === 'me'
              ? 'Bạn: '
              : user.laNhom && last
              ? `${
                  chat.nguoiDung.find(person => person.id === last.nguoiGuiId)
                    ?.tenNgan || 'Thành viên'
                }: `
              : '';
          return {
            chat: item,
            user,
            last,
            message: last ? sender + last.noiDung : 'Bắt đầu cuộc trò chuyện',
          };
        })
        .filter(item => khopTimKiem(item.user.ten + ' ' + item.message, query)),
    [chat.troChuyen, chat.nguoiDung, chat.tinNhan, query],
  );
  const open = async (nguoiDungId: string) => {
    Keyboard.dismiss();
    try {
      const troChuyenId = await chat.moChat(nguoiDungId);
      navigation.navigate('NoiDungChat', { troChuyenId, nguoiDungId });
    } catch {
      Alert.alert('Không mở được trò chuyện', 'Kiểm tra mạng và thử lại.');
    }
  };
  const firstName = chat.taiKhoan?.tenHienThi.split(' ').pop() || 'bạn';
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={items}
        keyExtractor={item => item.chat.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {!!chat.error && (
              <Text accessibilityLiveRegion="polite">{chat.error}</Text>
            )}
            <TieuDeManHinh
              title="Cùng trò chuyện"
              eyebrow={`Chào ${firstName}, hôm nay thế nào?`}
              onProfile={() => navigation.navigate('CaiDat')}
            />
            <ThanhTimKiem
              value={query}
              onChange={setQuery}
              placeholder="Tìm kiếm cuộc trò chuyện"
            />
            {!query.trim() && (
              <NguoiTrucTuyen
                users={chat.nguoiDung.filter(
                  user => user.online && !user.laNhom,
                )}
                onPress={user => open(user.id)}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          <TrangRong
            title={
              query.trim()
                ? 'Không tìm thấy cuộc trò chuyện'
                : 'Chưa có cuộc trò chuyện'
            }
            subtitle={
              query.trim()
                ? 'Thử một tên hoặc nội dung tin nhắn khác nhé.'
                : 'Vào Danh bạ và chọn một người để bắt đầu nhắn tin.'
            }
          />
        }
        renderItem={({ item }) => (
          <HangTroChuyen
            user={item.user}
            chat={item.chat}
            message={item.message}
            time={item.last ? thoiGianTroChuyen(item.last.thoiGian) : 'Mới'}
            onPress={() => open(item.user.id)}
          />
        )}
      />
    </SafeAreaView>
  );
};
