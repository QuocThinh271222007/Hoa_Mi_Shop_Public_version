export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packing'
  | 'shipping'
  | 'delivered'
  | 'returned'
  | 'cancelled'
  | 'canceled'  // legacy alias kept for safety
  | 'pickup'    // legacy alias kept for safety
  | 'delivering' // legacy alias kept for safety
  | string;    // allow any real DB status

export interface Profile {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  gender: string;
}

export interface Order {
  id: string;
  date: string;
  status: OrderStatus;
  statusLabel: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  timelineLabel: string;
  timelineAt: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  country: string;
}

export interface StatusTab {
  key: string;
  label: string;
}

export const STATUS_TABS: StatusTab[] = [
  { key: 'pending',   label: 'Chờ giao' },
  { key: 'delivered', label: 'Đã giao' },
  { key: 'returned',  label: 'Trả hàng' },
  { key: 'cancelled', label: 'Đã hủy' },
];

export const MOCK_PROFILE: Profile = {
  name: 'Tên',
  email: 'Email',
  phone: 'SĐT',
  birthday: '00/00/0000',
  gender: 'Nữ',
};

export const MOCK_ORDERS: Order[] = [
  {
    id: '123456',
    date: '00/00/0000',
    status: 'delivered',
    statusLabel: 'Đã giao hàng',
    productName: 'Sản phẩm',
    quantity: 1,
    price: 0,
    total: 0,
    timelineLabel: 'Giao hàng thành công vào',
    timelineAt: '00:00 00/00/0000',
  },
  {
    id: '123456',
    date: '00/00/0000',
    status: 'delivered',
    statusLabel: 'Đã giao hàng',
    productName: 'Sản phẩm',
    quantity: 1,
    price: 0,
    total: 0,
    timelineLabel: 'Giao hàng thành công vào',
    timelineAt: '00:00 00/00/0000',
  },
  {
    id: '123456',
    date: '00/00/0000',
    status: 'canceled',
    statusLabel: 'Đã hủy',
    productName: 'Sản phẩm',
    quantity: 1,
    price: 0,
    total: 0,
    timelineLabel: 'Đơn hàng đã hủy vào',
    timelineAt: '00:00 00/00/0000',
  },
  {
    id: '123456',
    date: '00/00/0000',
    status: 'canceled',
    statusLabel: 'Đã hủy',
    productName: 'Sản phẩm',
    quantity: 1,
    price: 0,
    total: 0,
    timelineLabel: 'Đơn hàng đã hủy vào',
    timelineAt: '00:00 00/00/0000',
  },
];

export const MOCK_ADDRESSES: Address[] = [
  {
    id: 'addr-1',
    name: 'Tên',
    phone: 'SĐT',
    address: 'Địa chỉ',
    country: 'Vietnam',
  },
  {
    id: 'addr-2',
    name: 'Tên',
    phone: 'SĐT',
    address: 'Địa chỉ',
    country: 'Vietnam',
  },
  {
    id: 'addr-3',
    name: 'Tên',
    phone: 'SĐT',
    address: 'Địa chỉ',
    country: 'Vietnam',
  },
];
