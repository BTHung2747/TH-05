import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import type { TinNhan } from '../../types';
import { dinhDangGio } from '../../utils/thoiGian';
import { styles } from './styles';
import { moGoogleMaps } from '../../../services/locationService';
export const BongBongTinNhan = ({
  message,
  senderName,
}: {
  message: TinNhan;
  senderName?: string;
}) => {
  const outgoing = message.nguoiGuiId === 'me';
  return (
    <View
      style={[styles.bubble, outgoing ? styles.outgoing : styles.incoming]}
      accessibilityLabel={`${outgoing ? 'Bạn' : senderName || 'Tin nhận'}: ${
        message.noiDung
      }, ${dinhDangGio(message.thoiGian)}`}
      accessible={!message.viTri}
    >
      {!outgoing && !!senderName && (
        <Text style={styles.sender}>{senderName}</Text>
      )}
      {message.viTri ? (
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel="Mở vị trí trong Google Maps"
          onPress={() => {
            moGoogleMaps(
              message.viTri!.latitude,
              message.viTri!.longitude,
            ).catch(() =>
              Alert.alert('Google Maps', 'Không mở được bản đồ trên thiết bị.'),
            );
          }}
        >
          <Text style={[styles.text, outgoing && styles.outgoingText]}>
            📍 Vị trí được chia sẻ
          </Text>
          <Text style={[styles.text, outgoing && styles.outgoingText]}>
            {message.viTri.latitude.toFixed(5)},{' '}
            {message.viTri.longitude.toFixed(5)}
          </Text>
          <Text style={[styles.time, outgoing && styles.outgoingText]}>
            Nhấn để mở Google Maps ↗
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.text, outgoing && styles.outgoingText]}>
          {message.noiDung}
        </Text>
      )}
      <Text style={[styles.time, outgoing && styles.outgoingText]}>
        {dinhDangGio(message.thoiGian)}
        {outgoing ? ' · Đã gửi' : ''}
      </Text>
    </View>
  );
};
