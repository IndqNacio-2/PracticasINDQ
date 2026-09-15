import type { Product } from './types';

export const CATEGORIES = ['Todos', 'Bebidas', 'Suplementos', 'Botanas', 'Ropa', 'Accesorios'];

export const INITIAL_PRODUCTS: Product[] = [
  { id: 1, name: 'Agua 1 L', category: 'Bebidas', price: 25, stock: 48, emoji: '💧', bgColor: '#DBEAFE' },
  { id: 2, name: 'Bebida energética', category: 'Bebidas', price: 45, stock: 3, emoji: '⚡', bgColor: '#FEF3C7' },
  { id: 3, name: 'Bebida isotónica', category: 'Bebidas', price: 35, stock: 15, emoji: '🥤', bgColor: '#D1FAE5' },
  { id: 4, name: 'Proteína de suero', category: 'Suplementos', price: 850, stock: 8, emoji: '💪', bgColor: '#EDE9FE' },
  { id: 5, name: 'Barra de proteína', category: 'Botanas', price: 40, stock: 2, emoji: '🍫', bgColor: '#FEE2E2' },
  { id: 6, name: 'Vaso mezclador', category: 'Accesorios', price: 120, stock: 0, emoji: '🧃', bgColor: '#F3F4F6' },
  { id: 7, name: 'Toalla deportiva', category: 'Accesorios', price: 150, stock: 6, emoji: '🏋️', bgColor: '#FDF4FF' },
  { id: 8, name: 'Playera deportiva', category: 'Ropa', price: 350, stock: 1, emoji: '👕', bgColor: '#ECFDF5' },
];
