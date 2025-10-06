import { Trip, Stop } from '@/types/bus';

const TRIPS_KEY = 'busPlanning_trips';
const STOPS_KEY = 'busPlanning_stops';

export function saveTrips(trips: Trip[]): void {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

export function loadTrips(): Trip[] {
  const stored = localStorage.getItem(TRIPS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return [];
    }
  }
  return [];
}

export function saveStops(stops: Stop[]): void {
  localStorage.setItem(STOPS_KEY, JSON.stringify(stops));
}

export function loadStops(): Stop[] {
  const stored = localStorage.getItem(STOPS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return [];
    }
  }
  return [];
}
