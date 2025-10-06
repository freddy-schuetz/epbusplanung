export interface Bus {
  id: string;
  name: string;
  seats: number;
  contractual: boolean;
}

export interface BusDetails {
  busId: string;
  kmHinweg: string;
  kmRueckweg: string;
  luggage: string;
  accommodation: string;
  notes: string;
}

export interface Trip {
  id: string;
  direction: 'hin' | 'rueck';
  reisecode: string;
  produktcode: string;
  reise: string;
  datum: string;
  uhrzeit: string;
  kontingent: number;
  buchungen: number;
  planningStatus: 'unplanned' | 'draft' | 'completed' | 'locked';
  groupId: string | null;
  busDetails: BusDetails | null;
}

export interface BusGroup {
  id: string;
  trip_number: string;
  bus_id: string | null;
  km_hinweg: string | null;
  km_rueckweg: string | null;
  luggage: string | null;
  accommodation: string | null;
  notes: string | null;
  status: string;
  user_id: string;
}

export interface Stop {
  Reisecode: string;
  Beförderung: string;
  Zeit: string;
}

export interface APIBooking {
  Reisecode: string;
  Produktcode?: string;
  Reise?: string;
  'Hinfahrt von'?: string;
  'Hinfahrt Kontingent'?: number;
  'Hinfahrt Buchungen'?: number;
  'Rückfahrt von'?: string;
  'Rückfahrt bis'?: string;
  'Rückfahrt Kontingent'?: number;
  'Rückfahrt Buchungen'?: number;
}

export interface APIResponse {
  success: boolean;
  data?: {
    trips: APIBooking[];
    stops: Stop[];
  };
}
