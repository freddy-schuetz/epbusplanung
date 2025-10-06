import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { StatsCard } from '@/components/StatsCard';
import { ControlBar } from '@/components/ControlBar';
import { DateRow } from '@/components/DateRow';
import { TripCard } from '@/components/TripCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Trip, Stop, APIResponse, APIBooking } from '@/types/bus';
import { convertDateToAPI, parseGermanDate, getWeekdayName, getTodayString, addDays } from '@/lib/dateUtils';
import { exportToCSV } from '@/lib/csvExport';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { fetchTrips, createTrips, updateTrip, createBusGroup, updateBusGroup, fetchBusGroups } from '@/lib/supabaseOperations';

const API_URL = 'https://n8n.ep-reisen.app/webhook/busfahrten-api';

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());
  const [nextGroupId, setNextGroupId] = useState(1);
  
  const [dateFrom, setDateFrom] = useState('2025-11-01');
  const [dateTo, setDateTo] = useState('2026-04-30');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDirection, setFilterDirection] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDragTrip, setActiveDragTrip] = useState<Trip | null>(null);

  // Redirect to auth if not logged in
  useEffect(() => {
    console.log('[Index] Auth state - User:', user?.email, 'Loading:', authLoading);
    if (!authLoading && !user) {
      console.log('[Index] No user found, redirecting to auth');
      navigate('/auth');
    } else if (!authLoading && user) {
      console.log('[Index] User authenticated, loading data');
    }
  }, [user, authLoading, navigate]);

  // Load data when user is available
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  // Set up real-time subscriptions for PLANNED trips only
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('trips-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips', filter: `user_id=eq.${user.id}` },
        () => {
          console.log('[Index] Realtime update detected, reloading data');
          loadAllData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Apply filters
  useEffect(() => {
    applyFilters();
  }, [trips, filterStatus, filterDirection]);

  const loadAllData = async () => {
    if (!user) return;
    
    console.log('[Index] Loading all data - planned from Supabase, unplanned from API');
    setIsLoading(true);
    
    try {
      // Load PLANNED trips from Supabase
      const plannedTrips = await loadPlannedTripsFromSupabase();
      console.log('[Index] Loaded planned trips from Supabase:', plannedTrips.length);
      
      // Load UNPLANNED trips from API (excluding already planned ones)
      const unplannedTrips = await loadUnplannedTripsFromAPI(plannedTrips);
      console.log('[Index] Loaded unplanned trips from API:', unplannedTrips.length);
      
      // Merge and set
      const allTrips = [...plannedTrips, ...unplannedTrips];
      console.log('[Index] Total trips:', allTrips.length);
      setTrips(allTrips);
      
    } catch (error) {
      console.error('[Index] Error loading data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlannedTripsFromSupabase = async (): Promise<Trip[]> => {
    if (!user) return [];
    
    try {
      const data = await fetchTrips(user.id);
      const busGroupsData = await fetchBusGroups(user.id);
      
      // Create a map of bus_groups by id for easy lookup
      const busGroupsMap = new Map(
        busGroupsData.map(bg => [
          bg.id,
          {
            busId: bg.bus_id || '',
            kmHinweg: bg.km_hinweg || '',
            kmRueckweg: bg.km_rueckweg || '',
            luggage: bg.luggage || '',
            accommodation: bg.accommodation || '',
            notes: bg.notes || '',
          }
        ])
      );
      
      return data.map((dbTrip: any) => ({
        id: dbTrip.id,
        direction: dbTrip.direction as 'hin' | 'rueck',
        reisecode: dbTrip.reisecode,
        produktcode: dbTrip.produktcode || '',
        reise: dbTrip.reise,
        datum: dbTrip.datum,
        uhrzeit: dbTrip.uhrzeit || '',
        kontingent: dbTrip.kontingent || 0,
        buchungen: dbTrip.buchungen || 0,
        planningStatus: (dbTrip.status || 'unplanned') as 'unplanned' | 'draft' | 'completed' | 'locked',
        groupId: dbTrip.group_id,
        busDetails: dbTrip.group_id ? busGroupsMap.get(dbTrip.group_id) || null : null,
      }));
    } catch (error) {
      console.error('[Index] Error loading planned trips:', error);
      return [];
    }
  };

  const loadUnplannedTripsFromAPI = async (plannedTrips: Trip[] = []): Promise<Trip[]> => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getCompleteData',
          dateFrom: convertDateToAPI(dateFrom),
          dateTo: convertDateToAPI(dateTo),
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result: APIResponse = await response.json();

      if (result.success && result.data) {
        setStops(result.data.stops);
        
        // Create a Set of planned trip keys for efficient lookup
        const plannedReisecodes = new Set(
          plannedTrips.map(t => `${t.reisecode}-${t.direction.toUpperCase()}`)
        );
        
        const unplannedTrips: Trip[] = [];
        
        result.data.trips.forEach(booking => {
          // Hinfahrt
          if (booking['Hinfahrt von']) {
            const tripKey = `${booking.Reisecode}-HIN`;
            
            // Skip if already planned
            if (!plannedReisecodes.has(tripKey)) {
              const hinStops = result.data.stops.filter(s => 
                s.Reisecode === booking.Reisecode && 
                s.Beförderung && s.Beförderung.toLowerCase().includes('hinfahrt')
              );

              unplannedTrips.push({
                id: tripKey,
                direction: 'hin',
                reisecode: booking.Reisecode,
                produktcode: booking.Produktcode || '',
                reise: booking.Reise || '',
                datum: booking['Hinfahrt von'] || '',
                uhrzeit: hinStops[0]?.Zeit || '',
                kontingent: booking['Hinfahrt Kontingent'] || 0,
                buchungen: booking['Hinfahrt Buchungen'] || 0,
                planningStatus: 'unplanned',
                groupId: null,
                busDetails: null,
              });
            }
          }

          // Rückfahrt
          if (booking['Rückfahrt von'] || booking['Rückfahrt bis']) {
            const tripKey = `${booking.Reisecode}-RUECK`;
            
            // Skip if already planned
            if (!plannedReisecodes.has(tripKey)) {
              const rueckStops = result.data.stops.filter(s => 
                s.Reisecode === booking.Reisecode && 
                s.Beförderung && s.Beförderung.toLowerCase().includes('rückfahrt')
              );

              unplannedTrips.push({
                id: tripKey,
                direction: 'rueck',
                reisecode: booking.Reisecode,
                produktcode: booking.Produktcode || '',
                reise: booking.Reise || '',
                datum: booking['Rückfahrt von'] || booking['Rückfahrt bis'] || '',
                uhrzeit: rueckStops[0]?.Zeit || '',
                kontingent: booking['Rückfahrt Kontingent'] || 0,
                buchungen: booking['Rückfahrt Buchungen'] || 0,
                planningStatus: 'unplanned',
                groupId: null,
                busDetails: null,
              });
            }
          }
        });
        
        return unplannedTrips;
      }
      
      return [];
    } catch (error) {
      console.error('[Index] Error loading unplanned trips from API:', error);
      return [];
    }
  };

  const applyFilters = () => {
    let filtered = trips;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(trip => trip.planningStatus === filterStatus);
    }
    
    if (filterDirection !== 'all') {
      filtered = filtered.filter(trip => trip.direction === filterDirection);
    }
    
    setFilteredTrips(filtered);
  };

  const loadFromAPI = async () => {
    console.log('[Index] Manual reload triggered');
    await loadAllData();
    toast.success('Daten erfolgreich geladen');
  };

  const setDateRange = (range: 'season' | 'month') => {
    const today = new Date();
    
    if (range === 'season') {
      setDateFrom('2025-11-01');
      setDateTo('2026-04-30');
    } else if (range === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateFrom(firstDay.toISOString().split('T')[0]);
      setDateTo(lastDay.toISOString().split('T')[0]);
    }
  };

  const toggleSelection = (tripId: string) => {
    const newSelection = new Set(selectedTrips);
    if (newSelection.has(tripId)) {
      newSelection.delete(tripId);
    } else {
      newSelection.add(tripId);
    }
    setSelectedTrips(newSelection);
  };

  const clearSelection = () => {
    setSelectedTrips(new Set());
  };

  const createGroupFromSelection = async () => {
    if (!user || selectedTrips.size === 0) {
      toast.error('Bitte wählen Sie mindestens eine Reise aus');
      return;
    }

    console.log('[Index] Creating group from selection:', selectedTrips.size, 'trips');
    
    // Generate proper UUID for group_id
    const groupId = crypto.randomUUID();
    
    try {
      // FIRST: Create the bus_group record
      await createBusGroup({
        id: groupId,
        status: 'draft',
      }, user.id);
      
      // Get the selected trips
      const selectedTripsList = trips.filter(t => selectedTrips.has(t.id));
      
      // THEN: Create entries in Supabase for each selected trip with the group_id
      const tripsToCreate = selectedTripsList.map(trip => ({
        ...trip,
        groupId,
        planningStatus: 'draft' as const,
        tripNumber: null, // trip_number is only in bus_groups
      }));
      
      await createTrips(tripsToCreate, user.id);
      
      setSelectedTrips(new Set());
      setNextGroupId(nextGroupId + 1);
      toast.success('Busplanung erstellt');
      
      // Reload data to show the new planned trips
      await loadAllData();
      
    } catch (error) {
      console.error('[Index] Error creating group:', error);
      toast.error('Fehler beim Erstellen der Busplanung');
    }
  };

  const updateGroup = async (groupId: string, updates: Partial<Trip>) => {
    try {
      // If busDetails are being updated, save them to bus_groups table
      if (updates.busDetails) {
        await updateBusGroup(groupId, {
          bus_id: updates.busDetails.busId || null, // Use null, not empty string
          km_hinweg: updates.busDetails.kmHinweg,
          km_rueckweg: updates.busDetails.kmRueckweg,
          luggage: updates.busDetails.luggage,
          accommodation: updates.busDetails.accommodation,
          notes: updates.busDetails.notes,
        });
      }
      
      await loadAllData();
    } catch (error) {
      console.error('[Index] Error updating group:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const completeGroup = async (groupId: string) => {
    const groupTrips = trips.filter(t => t.groupId === groupId);
    if (!groupTrips[0]?.busDetails?.busId) {
      toast.error('Bitte wählen Sie einen Bus aus');
      return;
    }

    try {
      for (const trip of groupTrips) {
        await updateTrip(trip.id, { planningStatus: 'completed' });
      }
      
      toast.success('Busplanung fertiggestellt');
      await loadAllData();
    } catch (error) {
      console.error('[Index] Error completing group:', error);
      toast.error('Fehler beim Fertigstellen');
    }
  };

  const setGroupToDraft = async (groupId: string) => {
    const groupTrips = trips.filter(t => t.groupId === groupId);
    
    try {
      for (const trip of groupTrips) {
        await updateTrip(trip.id, { planningStatus: 'draft' });
      }
      
      toast.info('Busplanung auf Entwurf zurückgesetzt');
      await loadAllData();
    } catch (error) {
      console.error('[Index] Error setting group to draft:', error);
      toast.error('Fehler beim Zurücksetzen');
    }
  };

  const lockGroup = async (groupId: string) => {
    const groupTrips = trips.filter(t => t.groupId === groupId);
    
    try {
      for (const trip of groupTrips) {
        await updateTrip(trip.id, { planningStatus: 'locked' });
      }
      
      toast.info('Busplanung gesperrt');
      await loadAllData();
    } catch (error) {
      console.error('[Index] Error locking group:', error);
      toast.error('Fehler beim Sperren');
    }
  };

  const unlockGroup = async (groupId: string) => {
    if (confirm('Möchten Sie diese Busplanung entsperren?')) {
      const groupTrips = trips.filter(t => t.groupId === groupId);
      
      try {
        for (const trip of groupTrips) {
          await updateTrip(trip.id, { planningStatus: 'completed' });
        }
        
        toast.info('Busplanung entsperrt');
        await loadAllData();
      } catch (error) {
        console.error('[Index] Error unlocking group:', error);
        toast.error('Fehler beim Entsperren');
      }
    }
  };

  const dissolveGroup = async (groupId: string) => {
    if (!confirm('Busplanung wirklich auflösen?')) return;
    
    console.log('[dissolveGroup] Attempting to delete bus_group with ID:', groupId);
    
    try {
      // First delete trips
      const { data: tripsData, error: tripsError, status: tripsStatus } = await supabase
        .from('trips')
        .delete()
        .eq('group_id', groupId);
      
      console.log('[dissolveGroup] Delete trips response:', { tripsData, tripsError, tripsStatus });
      
      if (tripsError) {
        console.error('[dissolveGroup] Error deleting trips:', tripsError);
        throw tripsError;
      }
      
      // Then delete bus_group
      const { data: groupData, error: groupError, status: groupStatus } = await supabase
        .from('bus_groups')
        .delete()
        .eq('id', groupId);
      
      console.log('[dissolveGroup] Delete bus_group response:', { groupData, groupError, groupStatus });
      
      if (!groupError && groupStatus === 204) {
        console.log('[dissolveGroup] Bus group deleted successfully');
      } else if (groupError) {
        console.error('[dissolveGroup] Bus group deletion failed:', groupError);
        throw groupError;
      }
      
      toast.success('Busplanung aufgelöst');
      await loadAllData();
    } catch (error) {
      console.error('[dissolveGroup] Error:', error);
      toast.error('Fehler beim Auflösen der Busplanung');
    }
  };

  const handleExportCSV = () => {
    try {
      exportToCSV(trips);
      toast.success('CSV exportiert');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const toggleAllSections = () => {
    toast.info('Funktion in Entwicklung');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      toast.error('Fehler beim Abmelden');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const draggedTrip = trips.find(t => t.id === event.active.id);
    if (draggedTrip) {
      setActiveDragTrip(draggedTrip);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTrip(null);

    if (!over || !over.id.toString().startsWith('dropzone-')) {
      return;
    }

    // Get the dragged trip
    const draggedTrip = trips.find(t => t.id === active.id);
    if (!draggedTrip || !user) {
      return;
    }

    // Determine which trips to group
    let tripsToGroup: Trip[];
    
    // If multiple trips are selected AND the dragged trip is one of them
    if (selectedTrips.size > 0 && selectedTrips.has(draggedTrip.id)) {
      // Group ALL selected trips together
      tripsToGroup = trips.filter(t => selectedTrips.has(t.id));
    } else {
      // Group only the dragged trip
      tripsToGroup = [draggedTrip];
    }

    // Only allow ungrouped trips
    const ungroupedTrips = tripsToGroup.filter(t => !t.groupId);
    if (ungroupedTrips.length === 0) {
      toast.error('Nur ungeplante Reisen können gruppiert werden');
      return;
    }

    try {
      // Create ONE group ID for all trips
      const groupId = crypto.randomUUID();

      // Create the bus_group first
      await createBusGroup({ 
        id: groupId,
        status: 'draft' 
      }, user.id);

      // INSERT new trips into Supabase (API trips are not in DB yet)
      // ALL trips get the SAME groupId
      const tripsToInsert = ungroupedTrips.map(trip => ({
        datum: trip.datum,
        direction: trip.direction,
        reise: trip.reise,
        reisecode: trip.reisecode,
        uhrzeit: trip.uhrzeit,
        produktcode: trip.produktcode,
        buchungen: trip.buchungen,
        kontingent: trip.kontingent,
        planningStatus: 'draft' as const,
        groupId: groupId,
      }));

      await createTrips(tripsToInsert, user.id);

      clearSelection();
      await loadAllData();
      toast.success(`${ungroupedTrips.length} Reise(n) zur Busplanung hinzugefügt`);
    } catch (error) {
      console.error('[Index] Error creating group from drag:', error);
      toast.error('Fehler beim Erstellen der Busplanung');
    }
  };

  // Organize data by date
  const organizedData = () => {
    const allDates = new Set<string>();
    const plannedGroupsByDate: Record<string, Array<{ groupId: string; trips: Trip[] }>> = {};
    const hinfahrtenByDate: Record<string, Trip[]> = {};
    const rueckfahrtenByDate: Record<string, Trip[]> = {};
    const processedGroups = new Set<string>();

    filteredTrips.forEach(trip => {
      const dateKey = trip.datum || 'Kein Datum';
      allDates.add(dateKey);

      if (!plannedGroupsByDate[dateKey]) plannedGroupsByDate[dateKey] = [];
      if (!hinfahrtenByDate[dateKey]) hinfahrtenByDate[dateKey] = [];
      if (!rueckfahrtenByDate[dateKey]) rueckfahrtenByDate[dateKey] = [];

      if (trip.groupId && !processedGroups.has(trip.groupId)) {
        const groupTrips = filteredTrips.filter(t => t.groupId === trip.groupId);
        const groupDate = groupTrips[0].datum;
        if (!plannedGroupsByDate[groupDate]) plannedGroupsByDate[groupDate] = [];
        plannedGroupsByDate[groupDate].push({
          groupId: trip.groupId,
          trips: groupTrips,
        });
        processedGroups.add(trip.groupId);
      } else if (!trip.groupId && trip.planningStatus === 'unplanned') {
        if (trip.direction === 'hin') {
          hinfahrtenByDate[dateKey].push(trip);
        } else {
          rueckfahrtenByDate[dateKey].push(trip);
        }
      }
    });

    const sortedDates = Array.from(allDates).sort((a, b) => {
      return parseGermanDate(a).getTime() - parseGermanDate(b).getTime();
    });

    return sortedDates.map(dateKey => ({
      dateKey,
      plannedGroups: plannedGroupsByDate[dateKey] || [],
      hinfahrten: hinfahrtenByDate[dateKey] || [],
      rueckfahrten: rueckfahrtenByDate[addDays(dateKey, 1)] || [],
    }));
  };

  const stats = {
    total: trips.length,
    groups: new Set(trips.filter(t => t.groupId).map(t => t.groupId)).size,
    completed: new Set(trips.filter(t => t.planningStatus === 'completed' || t.planningStatus === 'locked').map(t => t.groupId)).size,
    passengers: trips.reduce((sum, t) => sum + t.buchungen, 0),
  };

  const data = organizedData();
  const today = getTodayString();

  if (authLoading) {
    console.log('[Index] Still loading auth state...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Lädt...</p>
      </div>
    );
  }

  if (!user) {
    console.log('[Index] No user, should redirect to auth');
    return null;
  }

  console.log('[Index] Rendering main app for user:', user.email);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen p-5">
      <div className="max-w-[1800px] mx-auto bg-card/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-5xl font-bold gradient-primary bg-clip-text text-transparent">
            🚌 Busplanungs-Management System 5.1
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button onClick={handleSignOut} variant="outline" size="sm">
              Abmelden
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatsCard value={stats.total} label="Reisen gesamt" />
          <StatsCard value={stats.groups} label="Busplanungen" />
          <StatsCard value={stats.completed} label="Fertiggestellt" />
          <StatsCard value={stats.passengers} label="Gesamt Passagiere" />
        </div>

        <ControlBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onLoadData={loadFromAPI}
          onSetDateRange={setDateRange}
          filterStatus={filterStatus}
          filterDirection={filterDirection}
          onFilterStatusChange={setFilterStatus}
          onFilterDirectionChange={setFilterDirection}
          onToggleAllSections={toggleAllSections}
          onCreateGroup={createGroupFromSelection}
          onExportCSV={handleExportCSV}
          isLoading={isLoading}
        />

        {selectedTrips.size > 0 && (
          <Alert className="mb-6 bg-primary/10 border-primary">
            <AlertDescription className="flex items-center justify-between">
              <span className="font-semibold">{selectedTrips.size} Reisen ausgewählt</span>
              <Button onClick={clearSelection} variant="secondary" size="sm">
                Auswahl aufheben
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div>
          {data.length > 0 ? (
            data.map(({ dateKey, plannedGroups, hinfahrten, rueckfahrten }) => {
              if (plannedGroups.length === 0 && hinfahrten.length === 0 && rueckfahrten.length === 0) {
                return null;
              }

              const dateObj = parseGermanDate(dateKey);
              const weekday = getWeekdayName(dateObj);
              const nextDayKey = addDays(dateKey, 1);
              const isToday = dateKey === today;

              return (
                <DateRow
                  key={dateKey}
                  date={dateKey}
                  weekday={weekday}
                  isToday={isToday}
                  plannedGroups={plannedGroups}
                  hinfahrten={hinfahrten}
                  rueckfahrten={rueckfahrten}
                  nextDayKey={nextDayKey}
                  selectedTrips={selectedTrips}
                  onToggleSelection={toggleSelection}
                  onUpdateGroup={updateGroup}
                  onCompleteGroup={completeGroup}
                  onSetGroupToDraft={setGroupToDraft}
                  onLockGroup={lockGroup}
                  onUnlockGroup={unlockGroup}
                  onDissolveGroup={dissolveGroup}
                />
              );
            })
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <h3 className="text-2xl font-semibold mb-2">Keine Reisen geladen</h3>
              <p>Laden Sie Daten aus BusProNet um zu beginnen</p>
            </div>
          )}
        </div>
      </div>
    </div>
      
      <DragOverlay>
        {activeDragTrip ? (
          <TripCard
            trip={activeDragTrip}
            isSelected={selectedTrips.has(activeDragTrip.id)}
            onToggleSelection={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default Index;
