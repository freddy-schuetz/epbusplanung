import { supabase } from '@/integrations/supabase/client';
import { Trip, Bus } from '@/types/bus';

// Buses
export const fetchBuses = async () => {
  const { data, error } = await supabase
    .from('buses')
    .select('*')
    .order('name');
  
  if (error) throw error;
  
  // Map database fields to Bus type
  return data.map(bus => ({
    id: bus.id,
    name: bus.name,
    seats: bus.seats,
    licensePlate: bus.license_plate,
    contractual: bus.is_contractual,
  })) as Bus[];
};

// Trips
export const fetchTrips = async (userId: string) => {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  
  if (error) throw error;
  return data as unknown as Trip[];
};

export const createTrips = async (trips: Partial<Trip>[], userId: string) => {
  const tripsToInsert = trips.map(trip => ({
    user_id: userId,
    reisecode: trip.reisecode,
    direction: trip.direction,
    datum: trip.datum,
    uhrzeit: trip.uhrzeit,
    buchungen: trip.buchungen || 0,
    status: trip.planningStatus || 'unplanned',
    group_id: trip.groupId,
    trip_number: trip.tripNumber,
    produktcode: trip.produktcode || '',
    reise: trip.reise || '',
    kontingent: trip.kontingent || 0,
  }));

  const { data, error } = await supabase
    .from('trips')
    .insert(tripsToInsert)
    .select();
  
  if (error) throw error;
  return data;
};

export const updateTrip = async (id: string, updates: Partial<Trip>) => {
  const { data, error } = await supabase
    .from('trips')
    .update({
      status: updates.planningStatus,
      group_id: updates.groupId,
      trip_number: updates.tripNumber,
    })
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data;
};

export const deleteTrip = async (id: string) => {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Bus Groups
export const fetchBusGroups = async (userId: string) => {
  const { data, error } = await supabase
    .from('bus_groups')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  return data;
};

export const createBusGroup = async (groupData: any, userId: string) => {
  const { data, error } = await supabase
    .from('bus_groups')
    .insert({ ...groupData, user_id: userId })
    .select();
  
  if (error) throw error;
  return data;
};

export const updateBusGroup = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('bus_groups')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data;
};

export const deleteBusGroup = async (id: string) => {
  const { error } = await supabase
    .from('bus_groups')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};
