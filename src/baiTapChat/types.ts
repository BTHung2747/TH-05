import type { ImageSourcePropType } from 'react-native';

export interface NguoiDung {
  id: string;
  ten: string;
  tenNgan: string;
  avatar: ImageSourcePropType;
  online: boolean;
  laNhom?: boolean;
}
export interface TaiKhoan {
  id?: string;
  taiKhoan: string;
  tenHienThi: string;
  avatar: ImageSourcePropType;
}
export interface TroChuyen {
  id: string;
  nguoiDungId: string;
  soChuaDoc: number;
}
export interface TinNhan {
  viTri?: { latitude: number; longitude: number };
  id: string;
  troChuyenId: string;
  nguoiGuiId: string;
  noiDung: string;
  thoiGian: number;
}
export interface ThongBao {
  id: string;
  tieuDe: string;
  noiDung: string;
  thoiGian: string;
  daDoc: boolean;
  loai: 'tinNhan' | 'nhom' | 'heThong';
}
export interface TrangThaiChat {
  taiKhoan: TaiKhoan | null;
  nguoiDung: NguoiDung[];
  troChuyen: TroChuyen[];
  tinNhan: Record<string, TinNhan[]>;
  thongBao: ThongBao[];
  hienThiOnline: boolean;
  hienThiBadge: boolean;
}
