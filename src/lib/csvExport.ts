import { Trip, Stop } from '@/types/bus';
import { BUSES } from './buses';
import { supabase } from '@/integrations/supabase/client';

export async function exportToCSV(trips: Trip[], stops: Stop[]): Promise<void> {
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
  
  // Fetch bus_groups to get trip_numbers
  const groupIds = Object.keys(groups);
  const { data: busGroups } = await supabase
    .from('bus_groups')
    .select('id, trip_number')
    .in('id', groupIds);
  
  const busGroupsMap = new Map(busGroups?.map(bg => [bg.id, bg.trip_number]) || []);
  
  let csv = 'Fahrt-Nr;Bus;Richtung;Reisecodes;Datum;Passagiere;KM-Hinweg;KM-Rückweg;Gepäck;Fahrerzimmer;Anmerkungen;Haltestellen\n';
  
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
    
    const tripNumber = busGroupsMap.get(firstTrip.groupId || '') || firstTrip.groupId;
    
    // Get stops for this group
    const groupStops = stops.filter(stop => 
      groupTrips.some(trip => trip.reisecode === stop.Reisecode)
    );
    
    // Aggregate stops by location and time
    const aggregatedStops = groupStops.reduce((acc, stop) => {
      const location = stop['Zustieg/Ausstieg'] || 'Unbekannt';
      const key = `${stop.Zeit}-${location}`;
      if (!acc[key]) {
        acc[key] = {
          time: stop.Zeit,
          location: location,
          passengers: stop.Anzahl || 0,
        };
      } else {
        acc[key].passengers += stop.Anzahl || 0;
      }
      return acc;
    }, {} as Record<string, { time: string; location: string; passengers: number }>);
    
    // Sort by time and format
    const sortedStops = Object.values(aggregatedStops)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(stop => `${stop.time} ${stop.location} (${stop.passengers} PAX)`)
      .join(' | ');
    
    csv += `${tripNumber};${busName};${directionText};${reisecodes};${firstTrip.datum};${totalPassengers};${firstTrip.busDetails?.kmHinweg || ''};${firstTrip.busDetails?.kmRueckweg || ''};${firstTrip.busDetails?.luggage || ''};${firstTrip.busDetails?.accommodation || ''};${firstTrip.busDetails?.notes || ''};${sortedStops}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `busfahrten_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
