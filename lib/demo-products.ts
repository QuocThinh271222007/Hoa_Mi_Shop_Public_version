import type { Product } from './types';

export const demoProducts: Product[] = [
  {
    id: 'demo-01',
    slug: 'day-ao-cuc-hoa-mi-hong-cam',
    name: 'D\u00e2y \u00e1o hoa c\u00fac h\u1ecda mi h\u1ed3ng cam',
    price: 50000,
    image: '/assets/products/product-01.png',
    description: 'D\u00e2y \u00e1o ren hoa ph\u1ed1i h\u1ed3ng, cam v\u00e0 tr\u1eafng.',
    category: 'D\u00e2y \u00e1o',
    isBestseller: true,
    isNew: true,
    stock: 12
  },
  {
    id: 'demo-02',
    slug: 'day-ao-vuon-hoa-mua-ha',
    name: 'D\u00e2y \u00e1o v\u01b0\u1eddn hoa m\u00f9a h\u1ea1',
    price: 50000,
    image: '/assets/products/product-02.png',
    description: 'D\u00e2y \u00e1o hoa nhi\u1ec1u m\u00e0u pastel, n\u1ec1n tr\u1eafng.',
    category: 'D\u00e2y \u00e1o',
    isBestseller: true,
    stock: 9
  },
  {
    id: 'demo-03',
    slug: 'day-ao-suong-xanh',
    name: 'D\u00e2y \u00e1o s\u01b0\u01a1ng xanh',
    price: 45000,
    image: '/assets/products/product-03.png',
    description: 'D\u00e2y \u00e1o ren xanh b\u1ea1c nh\u1eb9, h\u1ee3p ph\u1ed1i \u0111\u1ed3 pastel.',
    category: 'D\u00e2y \u00e1o',
    isBestseller: true,
    stock: 7
  },
  {
    id: 'demo-04',
    slug: 'day-ao-hoa-dem',
    name: 'D\u00e2y \u00e1o hoa \u0111\u00eam',
    price: 45000,
    image: '/assets/products/product-04.png',
    description: 'D\u00e2y \u00e1o n\u1ec1n xanh navy, hoa h\u1ed3ng t\u00edm n\u1ed5i b\u1eadt.',
    category: 'D\u00e2y \u00e1o',
    isNew: true,
    stock: 5
  },
  {
    id: 'demo-05',
    slug: 'day-ao-hong-phan',
    name: 'D\u00e2y \u00e1o h\u1ed3ng ph\u1ea5n',
    price: 45000,
    image: '/assets/products/product-05.png',
    description: 'D\u00e2y \u00e1o ren hoa h\u1ed3ng ph\u1ea5n, n\u1eef t\u00ednh v\u00e0 nh\u1eb9 nh\u00e0ng.',
    category: 'D\u00e2y \u00e1o',
    isNew: true,
    stock: 15
  },
  {
    id: 'demo-06',
    slug: 'day-ao-xanh-ngoc',
    name: 'D\u00e2y \u00e1o xanh ng\u1ecdc',
    price: 45000,
    image: '/assets/products/product-06.png',
    description: 'D\u00e2y \u00e1o xanh ng\u1ecdc \u0111\u00ednh hoa xanh d\u01b0\u01a1ng.',
    category: 'D\u00e2y \u00e1o',
    isNew: true,
    stock: 8
  },
  {
    id: 'demo-07',
    slug: 'day-ao-nut-tim',
    name: 'D\u00e2y \u00e1o n\u00fat t\u00edm',
    price: 50000,
    image: '/assets/products/product-07.png',
    description: 'D\u00e2y \u00e1o tr\u1eafng \u0111\u00ednh n\u00fat t\u00edm, d\u00e1ng vui m\u1eaft.',
    category: 'D\u00e2y \u00e1o',
    isNew: true,
    stock: 11
  }
];

export const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(price);
