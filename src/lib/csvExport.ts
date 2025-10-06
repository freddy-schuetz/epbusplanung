import { Trip } from '@/types/bus';
import { BUSES } from './buses';

export function exportToCSV(trips: Trip[]): void {
  const groups: Record<string, Trip[]> = {};
  
  trips.forEach(trip => {
    if (trip.groupId && (trip.planningStatus === 'completed' || trip.planningStatus === 'locked')) {
      if (!groups[trip.groupId]) groups[trip.groupId] = [];
      groups[trip.groupId].push(trip);
    }
  });
  
  if (Object.keys(groups).length === 0) {
    throw new Error('Keine fertiggestellten Busfahrten zum Export');
  }
  
  let csv = 'Fahrt-Nr;Bus;Richtung;Reisecodes;Datum;Passagiere;KM-Hinweg;KM-Rückweg;Gepäck;Fahrerzimmer;Anmerkungen\n';
  
  Object.values(groups).forEach(groupTrips => {
    const firstTrip = groupTrips[0];
    const reisecodes = groupTrips.map(t => t.reisecode).join(', ');
    const totalPassengers = groupTrips.reduce((sum, t) => sum + t.buchungen, 0);
    
    let busName = '';
    if (firstTrip.busDetails?.busId) {
      const bus = BUSES.find(b => b.id === firstTrip.busDetails!.busId);
      if (bus) busName = `${bus.name} (${bus.seats} Plätze)`;
    }
    
    const hasHin = groupTrips.some(t => t.direction === 'hin');
    const hasRueck = groupTrips.some(t => t.direction === 'rueck');
    const directionText = hasHin && hasRueck ? 'Hin+Rückfahrt' : firstTrip.direction === 'hin' ? 'Hinfahrt' : 'Rückfahrt';
    
    csv += `${firstTrip.groupId};${busName};${directionText};${reisecodes};${firstTrip.datum};${totalPassengers};${firstTrip.busDetails?.kmHinweg || ''};${firstTrip.busDetails?.kmRueckweg || ''};${firstTrip.busDetails?.luggage || ''};${firstTrip.busDetails?.accommodation || ''};${firstTrip.busDetails?.notes || ''}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `busfahrten_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
