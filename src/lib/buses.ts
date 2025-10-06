import { Bus } from '@/types/bus';

export const BUSES: Bus[] = [
  { id: 'finkbeiner-2', name: 'Finkbeiner-2', seats: 49, contractual: false },
  { id: 'finkbeiner-3', name: 'Finkbeiner-3', seats: 50, contractual: true },
  { id: 'finkbeiner-4', name: 'Finkbeiner-4', seats: 54, contractual: true },
  { id: 'finkbeiner-5', name: 'Finkbeiner-5', seats: 57, contractual: false },
  { id: 'heess-1', name: 'Heeß-1', seats: 57, contractual: true },
  { id: 'heess-2', name: 'Heeß-2', seats: 54, contractual: false },
  { id: 'picco-4', name: 'Picco-4', seats: 49, contractual: false },
  { id: 'piccolonia', name: 'Piccolonia', seats: 54, contractual: false },
  { id: 'boonk', name: 'Boonk', seats: 50, contractual: false },
  { id: 'marti', name: 'Marti', seats: 57, contractual: true },
  { id: 'hager', name: 'Hager', seats: 61, contractual: true }
];
