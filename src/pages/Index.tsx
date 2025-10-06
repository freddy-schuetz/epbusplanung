import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/StatsCard';
import { ControlBar } from '@/components/ControlBar';
import { DateRow } from '@/components/DateRow';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Trip, Stop, APIResponse, APIBooking } from '@/types/bus';
import { loadTrips, saveTrips, loadStops, saveStops } from '@/lib/storage';
import { convertDateToAPI, formatDate, parseGermanDate, getWeekdayName, getTodayString, addDays } from '@/lib/dateUtils';
import { exportToCSV } from '@/lib/csvExport';
import { toast } from 'sonner';

const API_URL = 'https://n8n.ep-reisen.app/webhook/busfahrten-api';

const Index = () => {
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

  useEffect(() => {
    const loadedTrips = loadTrips();
    const loadedStops = loadStops();
    setTrips(loadedTrips);
    setStops(loadedStops);
    setFilteredTrips(loadedTrips);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trips, filterStatus, filterDirection]);

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
    setIsLoading(true);
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
        mergeWithExistingData(result.data.trips, result.data.stops);
        toast.success('Daten erfolgreich geladen');
      }
    } catch (error) {
      console.error('API Error:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
    }
  };

  const mergeWithExistingData = (apiTrips: APIBooking[], apiStops: Stop[]) => {
    const plannedTrips = trips.filter(trip => trip.planningStatus !== 'unplanned');
    let newTrips = [...plannedTrips];

    apiTrips.forEach(booking => {
      // Hinfahrt
      if (booking['Hinfahrt von']) {
        const hinId = `${booking.Reisecode}-HIN`;
        const existingPlanned = plannedTrips.find(t => t.id === hinId);

        if (!existingPlanned) {
          const hinStops = apiStops.filter(s => 
            s.Reisecode === booking.Reisecode && 
            s.Beförderung && s.Beförderung.toLowerCase().includes('hinfahrt')
          );

          newTrips.push({
            id: hinId,
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
            tripNumber: null,
            busDetails: null,
          });
        }
      }

      // Rückfahrt
      if (booking['Rückfahrt von'] || booking['Rückfahrt bis']) {
        const rueckId = `${booking.Reisecode}-RUECK`;
        const existingPlanned = plannedTrips.find(t => t.id === rueckId);

        if (!existingPlanned) {
          const rueckStops = apiStops.filter(s => 
            s.Reisecode === booking.Reisecode && 
            s.Beförderung && s.Beförderung.toLowerCase().includes('rückfahrt')
          );

          newTrips.push({
            id: rueckId,
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
            tripNumber: null,
            busDetails: null,
          });
        }
      }
    });

    setTrips(newTrips);
    setStops(apiStops);
    saveTrips(newTrips);
    saveStops(apiStops);
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

  const createGroupFromSelection = () => {
    if (selectedTrips.size === 0) {
      toast.error('Bitte wählen Sie mindestens eine Reise aus');
      return;
    }

    const groupId = `group-${Date.now()}-${nextGroupId}`;
    const updatedTrips = trips.map(trip => {
      if (selectedTrips.has(trip.id)) {
        return {
          ...trip,
          groupId,
          planningStatus: 'draft' as const,
          tripNumber: String(nextGroupId).padStart(3, '0'),
        };
      }
      return trip;
    });

    setTrips(updatedTrips);
    saveTrips(updatedTrips);
    setSelectedTrips(new Set());
    setNextGroupId(nextGroupId + 1);
    toast.success('Busplanung erstellt');
  };

  const updateGroup = (groupId: string, updates: Partial<Trip>) => {
    const updatedTrips = trips.map(trip => {
      if (trip.groupId === groupId) {
        return { ...trip, ...updates };
      }
      return trip;
    });
    setTrips(updatedTrips);
    saveTrips(updatedTrips);
  };

  const completeGroup = (groupId: string) => {
    const groupTrips = trips.filter(t => t.groupId === groupId);
    if (!groupTrips[0]?.busDetails?.busId) {
      toast.error('Bitte wählen Sie einen Bus aus');
      return;
    }

    const updatedTrips = trips.map(trip => {
      if (trip.groupId === groupId) {
        return { ...trip, planningStatus: 'completed' as const };
      }
      return trip;
    });
    setTrips(updatedTrips);
    saveTrips(updatedTrips);
    toast.success('Busplanung fertiggestellt');
  };

  const setGroupToDraft = (groupId: string) => {
    const updatedTrips = trips.map(trip => {
      if (trip.groupId === groupId) {
        return { ...trip, planningStatus: 'draft' as const };
      }
      return trip;
    });
    setTrips(updatedTrips);
    saveTrips(updatedTrips);
    toast.info('Busplanung auf Entwurf zurückgesetzt');
  };

  const lockGroup = (groupId: string) => {
    const updatedTrips = trips.map(trip => {
      if (trip.groupId === groupId) {
        return { ...trip, planningStatus: 'locked' as const };
      }
      return trip;
    });
    setTrips(updatedTrips);
    saveTrips(updatedTrips);
    toast.info('Busplanung gesperrt');
  };

  const unlockGroup = (groupId: string) => {
    if (confirm('Möchten Sie diese Busplanung entsperren?')) {
      const updatedTrips = trips.map(trip => {
        if (trip.groupId === groupId) {
          return { ...trip, planningStatus: 'completed' as const };
        }
        return trip;
      });
      setTrips(updatedTrips);
      saveTrips(updatedTrips);
      toast.info('Busplanung entsperrt');
    }
  };

  const dissolveGroup = (groupId: string) => {
    const updatedTrips = trips.map(trip => {
      if (trip.groupId === groupId) {
        return {
          ...trip,
          groupId: null,
          tripNumber: null,
          planningStatus: 'unplanned' as const,
          busDetails: null,
        };
      }
      return trip;
    });
    setTrips(updatedTrips);
    saveTrips(updatedTrips);
    toast.info('Busplanung aufgelöst');
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
    // This would toggle all DateRow components
    // Implementation would require lifting state or using a ref pattern
    toast.info('Funktion in Entwicklung');
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

  return (
    <div className="min-h-screen p-5">
      <div className="max-w-[1800px] mx-auto bg-card/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
        <h1 className="text-5xl font-bold text-center mb-8 gradient-primary bg-clip-text text-transparent">
          🚌 Busplanungs-Management System 5.1
        </h1>

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
  );
};

export default Index;
