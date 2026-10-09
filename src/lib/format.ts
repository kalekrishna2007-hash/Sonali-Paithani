export const inr = (amount: number | null | undefined) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 'On request';
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const inrRaw = (amount: number | null | undefined) => {
  const value = Number(amount);
  return Number.isFinite(value) ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '₹0';
};

export const telHref = (phone: string) => `tel:+${String(phone).replace(/\D/g, '')}`;

export const whatsappChatUrl = (phone: string, message?: string) => {
  const digits = String(phone).replace(/\D/g, '');
  return message ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : `https://wa.me/${digits}`;
};

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const relativeTime = (value?: string | null) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(value);
};

export const stockLabel = (product: { stock: number; low_stock_threshold: number }) => {
  if (product.stock < 0) return { text: `Oversold — ${Math.abs(product.stock)} to weave`, tone: 'is-out' as const };
  if (product.stock === 0) return { text: 'Made to order', tone: 'is-out' as const };
  if (product.stock <= product.low_stock_threshold) return { text: `Only ${product.stock} in stock`, tone: 'is-low' as const };
  return { text: `${product.stock} in stock`, tone: '' as const };
};

export const titleCase = (value: string) => value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const priceRange = (min: number, max: number) => `${inrRaw(min)} – ${inrRaw(max)}`;
