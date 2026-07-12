export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  images?: string[];
  description: string;
  category: string;
  isBestseller?: boolean;
  isNew?: boolean;
  stock?: number;
};

export type CartItem = Product & {
  quantity: number;
};
