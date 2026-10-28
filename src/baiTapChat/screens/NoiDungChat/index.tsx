import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatRoutes } from '../../navigation/types';
import type { TinNhan } from '../../types';
import { AnhDaiDien } from '../../components/AnhDaiDien';
import { BongBongTinNhan } from '../../components/BongBongTinNhan';
import { BieuTuong, TrangRong } from '../../components/common';
import { useChat } from '../../state/ChatContext';
import { themeChat as theme } from '../../styles/theme';
import { dinhDangNgay } from '../../utils/thoiGian';
import { styles } from './styles';
import { useFocusEffect } from '@react-navigation/native';

export const NoiDungChat = ({
  navigation,
  route,
}: NativeStackScreenProps<ChatRoutes, 'NoiDungChat'>) => {
  const chat = useChat();
  const { troChuyenId } = route.params;
  const conversation = chat.troChuyen.find(item => item.id === troChuyenId);
  const user = chat.nguoiDung.find(
    item => item.id === (conversation?.nguoiDungId || route.params.nguoiDungId),
  );
  const messages = chat.tinNhan[troChuyenId] || [];
  const listRef = useRef<FlatList<TinNhan>>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [locating, setLocating] = useState(false);
  const chatRef = useRef(chat);
  chatRef.current = chat;
  useFocusEffect(
    useCallback(() => {
      chatRef.current.docChat(troChuyenId);
      return () => chatRef.current.dongChat(troChuyenId);
    }, [troChuyenId]),
  );
  const send = async () => {
    if (sending || !text.trim()) return;
    const draft = text;
    setSending(true);
    try {
      if (await chat.guiTin(troChuyenId, draft))
        setText(current => (current === draft ? '' : current));
      else
        Alert.alert(
          'Chưa gửi được tin',
          'Kiểm tra kết nối và thử lại. Nội dung đã được giữ lại.',
        );
    } finally {
      setSending(false);
    }
  };
  const sendLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      await chat.guiViTri(troChuyenId);
    } catch (cause) {
      Alert.alert(
        'Gửi vị trí',
        cause instanceof Error ? cause.message : 'Không gửi được vị trí.',
      );
    } finally {
      setLocating(false);
    }
  };
  const scrollToEnd = () =>
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: false }),
    );
  if (!user)
    return (
      <SafeAreaView style={styles.screen}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <BieuTuong name="back" />
        </TouchableOpacity>
        <TrangRong title="Không tìm thấy cuộc trò chuyện" />
      </SafeAreaView>
    );
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.65}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <BieuTuong name="back" color={theme.colors.text} />
          </TouchableOpacity>
          <AnhDaiDien source={user.avatar} size={44} online={user.online} />
          <View style={styles.headerCopy}>
            <Text style={styles.name} accessibilityRole="header">
              {user.ten}
            </Text>
            <Text style={styles.status}>
              {user.laNhom
                ? 'Nhóm học tập · 4 thành viên'
                : user.online
                ? 'Đang trực tuyến'
                : 'Ngoại tuyến'}
            </Text>
          </View>
        </View>
        <FlatList
          ref={listRef}
          style={styles.messages}
          data={messages}
          keyExtractor={message => message.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.messageContent}
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <TrangRong
              title={`Chào ${user.tenNgan}!`}
              subtitle="Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện."
            />
          }
          renderItem={({ item, index }) => (
            <View>
              {(index === 0 ||
                dinhDangNgay(messages[index - 1].thoiGian) !==
                  dinhDangNgay(item.thoiGian)) && (
                <Text style={styles.date}>{dinhDangNgay(item.thoiGian)}</Text>
              )}
              <BongBongTinNhan
                message={item}
                senderName={
                  user.laNhom && item.nguoiGuiId !== 'me'
                    ? chat.nguoiDung.find(
                        person => person.id === item.nguoiGuiId,
                      )?.ten
                    : undefined
                }
              />
            </View>
          )}
        />
        <View style={styles.composer}>
          <TouchableOpacity
            onPress={sendLocation}
            disabled={locating}
            style={styles.locationButton}
            accessibilityRole="button"
            accessibilityLabel="Gửi vị trí hiện tại"
          >
            <Text style={styles.locationIcon}>{locating ? '…' : '📍'}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Nhập tin nhắn…"
            placeholderTextColor={theme.colors.secondary}
            accessibilityLabel="Nội dung tin nhắn"
            multiline
            maxLength={2000}
            textAlignVertical="center"
          />
          <TouchableOpacity
            onPress={send}
            disabled={!text.trim() || sending}
            accessibilityState={{ disabled: !text.trim() || sending }}
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
            activeOpacity={0.65}
            style={[styles.send, !text.trim() && styles.disabled]}
          >
            <BieuTuong name="send" color={theme.colors.white} size={22} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};
