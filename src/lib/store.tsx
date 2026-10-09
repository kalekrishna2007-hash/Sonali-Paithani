import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { EnquiryDraftItem, Product, PublicSettings } from './types';

const WISHLIST_KEY = 'sp_wishlist_v1';
const CART_KEY = 'sp_enquiry_cart_v1';

type Toast = { id: number; message: string; tone: 'info' | 'success' | 'error' };

interface AppValue {
  settings: PublicSettings | null;
  refreshSettings: () => Promise<void>;
  wishlist: Product[];
  wishlistCount: number;
  isWished: (id: string) => boolean;
  toggleWish: (product: Product) => void;
  clearWishlist: () => void;
  cart: EnquiryDraftItem[];
  cartCount: number;
  cartTotal: number;
  addToEnquiry: (product: Product, options?: Partial<Pick<EnquiryDraftItem, 'quantity' | 'size' | 'color' | 'notes'>>) => void;
  /** Adds one named saree to the enquiry list and opens the dialog on it. */
  enquireAbout: (product: Product, options?: Partial<Pick<EnquiryDraftItem, 'quantity' | 'size' | 'color' | 'notes'>>) => void;
  updateCartItem: (productId: string, patch: Partial<EnquiryDraftItem>) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  enquiryOpen: boolean;
  openEnquiry: () => void;
  closeEnquiry: () => void;
  toasts: Toast[];
  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppValue | null>(null);

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const draftFrom = (product: Product, options: Partial<EnquiryDraftItem> = {}): EnquiryDraftItem => ({
  product: {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    images: product.images,
    sizes: product.sizes,
    colors: product.colors,
  },
  quantity: options.quantity ?? 1,
  size: options.size ?? product.sizes[0] ?? '',
  color: options.color ?? product.colors[0] ?? '',
  notes: options.notes ?? '',
});

/** Every enquiry line is one specific saree — merge, never a blank entry. */
const mergeCart = (
  current: EnquiryDraftItem[],
  product: Product,
  options: Partial<EnquiryDraftItem> = {},
): EnquiryDraftItem[] => {
  const existing = current.find((item) => item.product.id === product.id);
  if (existing) {
    return current.map((item) =>
      item.product.id === product.id
        ? {
            ...item,
            quantity: item.quantity + (options.quantity ?? 1),
            size: options.size ?? item.size,
            color: options.color ?? item.color,
          }
        : item,
    );
  }
  return [...current, draftFrom(product, options)];
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [wishlist, setWishlist] = useState<Product[]>(() => read<Product[]>(WISHLIST_KEY, []));
  const [cart, setCart] = useState<EnquiryDraftItem[]>(() => read<EnquiryDraftItem[]>(CART_KEY, []));
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refreshSettings = useCallback(async () => {
    try {
      setSettings(await api.settings());
    } catch {
      /* storefront still renders with fallback copy */
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const value = useMemo<AppValue>(() => {
    const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    return {
      settings,
      refreshSettings,
      wishlist,
      wishlistCount: wishlist.length,
      isWished: (id) => wishlist.some((item) => item.id === id),
      toggleWish: (product) =>
        setWishlist((current) =>
          current.some((item) => item.id === product.id)
            ? current.filter((item) => item.id !== product.id)
            : [...current, product],
        ),
      clearWishlist: () => setWishlist([]),
      cart,
      cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      cartTotal,
      addToEnquiry: (product, options = {}) => setCart((current) => mergeCart(current, product, options)),
      enquireAbout: (product, options = {}) => {
        setCart((current) => mergeCart(current, product, options));
        setEnquiryOpen(true);
      },
      updateCartItem: (productId, patch) =>
        setCart((current) => current.map((item) => (item.product.id === productId ? { ...item, ...patch } : item))),
      removeFromCart: (productId) => setCart((current) => current.filter((item) => item.product.id !== productId)),
      clearCart: () => setCart([]),
      enquiryOpen,
      openEnquiry: () => setEnquiryOpen(true),
      closeEnquiry: () => setEnquiryOpen(false),
      toasts,
      notify,
      dismissToast: (id) => setToasts((current) => current.filter((toast) => toast.id !== id)),
    };
  }, [settings, refreshSettings, wishlist, cart, enquiryOpen, toasts, notify]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
