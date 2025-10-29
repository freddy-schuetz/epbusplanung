import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trip, Stop } from '@/types/bus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HubDialogProps {
  open: boolean;
  onClose: () => void;
  currentGroup: {
    id: string;
    trips: Trip[];
  };
  allTrips: Trip[];
  stops: Stop[];
  onHubCreated: () => void;
}

export const HubDialog = ({
  open,
  onClose,
  currentGroup,
  allTrips,
  stops,
  onHubCreated,
}: HubDialogProps) => {
  const [step, setStep] = useState(1);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [candidateTrips, setCandidateTrips] = useState<Trip[]>([]);

  // Get stops for current trips
  const currentTripStops = stops.filter(stop =>
    currentGroup.trips.some(trip => trip.reisecode === stop.Reisecode)
  );

  // Get unique stop names (excluding first and last)
  const uniqueStops = [...new Set(
    currentTripStops
      .map(s => s['Zustieg/Ausstieg'])
      .filter(Boolean)
  )].slice(1, -1); // Exclude first and last stops

  const handleStopSelect = (stopName: string) => {
    setSelectedStop(stopName);
    
    // Find ALL trips passing through this stop on same day
    // Passengers from different origins going to different destinations can be redistributed!
    const date = currentGroup.trips[0].datum;
    const candidates = allTrips.filter(trip => {
      // Skip trips already in current group
      if (currentGroup.trips.some(t => t.id === trip.id)) return false;
      
      // Must be unplanned (not already assigned to a group)
      if (trip.planningStatus !== 'unplanned') return false;
      
      // Must be same date
      if (trip.datum !== date) return false;
      
      // Must pass through selected hub stop - this is the ONLY requirement!
      const tripStops = stops.filter(s => s.Reisecode === trip.reisecode);
      return tripStops.some(s => s['Zustieg/Ausstieg'] === stopName);
    });
    
    setCandidateTrips(candidates);
    setStep(2);
  };

  const handleTripToggle = (tripId: string) => {
    setSelectedTripIds(prev =>
      prev.includes(tripId)
        ? prev.filter(id => id !== tripId)
        : [...prev, tripId]
    );
  };

  const handleCreateHub = async () => {
    if (!selectedStop) return;

    const hubId = `hub-${selectedStop.toLowerCase().replace(/\s+/g, '-')}-${currentGroup.trips[0].datum}-${Date.now()}`;
    
    try {
      // Mark current group as incoming
      await supabase
        .from('bus_groups')
        .update({
          hub_role: 'incoming',
          hub_id: hubId,
          hub_location: selectedStop,
        })
        .eq('id', currentGroup.id);

      // Create outgoing groups for each selected trip
      // Group by destination
      const tripsByDestination = new Map<string, Trip[]>();
      selectedTripIds.forEach(tripId => {
        const trip = candidateTrips.find(t => t.id === tripId);
        if (trip) {
          const destination = trip.reise.split(' - ')[0]?.trim() || trip.reise;
          const existing = tripsByDestination.get(destination) || [];
          tripsByDestination.set(destination, [...existing, trip]);
        }
      });

      // Create a bus group for each destination
      for (const [destination, trips] of tripsByDestination.entries()) {
        const { data: newGroup } = await supabase
          .from('bus_groups')
          .insert({
            user_id: (await supabase.auth.getUser()).data.user!.id,
            status: 'draft',
            hub_role: 'outgoing',
            hub_id: hubId,
            hub_location: selectedStop,
          })
          .select()
          .single();

        if (newGroup) {
          // Update trips to belong to new group
          await supabase
            .from('trips')
            .update({
              group_id: newGroup.id,
              status: 'draft',
            })
            .in('id', trips.map(t => t.id));
        }
      }

      toast.success(`Hub "${selectedStop}" erstellt mit ${tripsByDestination.size} ausgehenden Fahrten`);
      onHubCreated();
      onClose();
      
    } catch (error) {
      console.error('Error creating hub:', error);
      toast.error('Fehler beim Erstellen des Hubs');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            🔄 Hub definieren
            {step > 1 && <Badge className="ml-2">Schritt {step}/3</Badge>}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wählen Sie eine Haltestelle als Umsteigepunkt:
            </p>
            <div className="space-y-2">
              {uniqueStops.map(stop => (
                <Button
                  key={stop}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStopSelect(stop)}
                >
                  📍 {stop}
                </Button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-semibold">Hub-Standort: {selectedStop}</p>
              <p className="text-sm text-muted-foreground">
                Datum: {currentGroup.trips[0].datum}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg mb-3">
              <p className="text-sm font-semibold">📍 Fahrten durch {selectedStop} am {currentGroup.trips[0].datum}:</p>
              <p className="text-xs text-muted-foreground mt-1">
                Wählen Sie ALLE Fahrten durch diesen Hub - Passagiere werden automatisch neu verteilt!
              </p>
            </div>

            {candidateTrips.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ Keine anderen Fahrten mit Halt in {selectedStop} gefunden.
                  Hub nicht möglich.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {candidateTrips.map(trip => {
                  // Extract origin and destination from trip name
                  const parts = trip.reise.split(' - ');
                  const origin = parts[parts.length - 1]?.trim() || trip.reise;
                  const destination = parts[0]?.trim() || trip.reise;
                  
                  return (
                    <div
                      key={trip.id}
                      className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedTripIds.includes(trip.id)}
                        onCheckedChange={() => handleTripToggle(trip.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{origin} → {destination}</p>
                        <p className="text-sm text-muted-foreground">
                          {trip.direction === 'hin' ? '🟢 HIN' : '🔴 RÜCK'} • {trip.uhrzeit} • {trip.buchungen} PAX
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          🔄 Passagiere werden im Hub neu verteilt
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                Zurück
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={selectedTripIds.length === 0}
              >
                Weiter ({selectedTripIds.length} {selectedTripIds.length === 1 ? 'Fahrt' : 'Fahrten'} ausgewählt)
              </Button>
            </DialogFooter>
            
            {selectedTripIds.length === 0 && candidateTrips.length > 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Mindestens 1 Fahrt auswählen um Hub zu erstellen
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-semibold">🔄 Hub-Konfiguration</p>
              <p className="text-sm">Hub-Standort: {selectedStop}</p>
              <p className="text-sm">Datum: {currentGroup.trips[0].datum}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Incoming trips */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">📥 Ankommend:</h4>
                {currentGroup.trips.map(trip => {
                  const origin = trip.reise.split(' - ')[trip.reise.split(' - ').length - 1]?.trim() || trip.reise;
                  return (
                    <div key={trip.id} className="p-2 border rounded-lg bg-green-50 dark:bg-green-950/20 text-sm">
                      <p className="font-medium">{origin} → {selectedStop}</p>
                      <p className="text-xs text-muted-foreground">{trip.buchungen} PAX</p>
                    </div>
                  );
                })}
                {selectedTripIds.map(tripId => {
                  const trip = candidateTrips.find(t => t.id === tripId);
                  if (!trip) return null;
                  const origin = trip.reise.split(' - ')[trip.reise.split(' - ').length - 1]?.trim() || trip.reise;
                  return (
                    <div key={trip.id} className="p-2 border rounded-lg bg-green-50 dark:bg-green-950/20 text-sm">
                      <p className="font-medium">{origin} → {selectedStop}</p>
                      <p className="text-xs text-muted-foreground">{trip.buchungen} PAX</p>
                    </div>
                  );
                })}
              </div>

              {/* Outgoing trips (automatically generated) */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">📤 Weiterfahrend (automatisch):</h4>
                {(() => {
                  // Group trips by destination
                  const destinationMap = new Map<string, { totalPax: number; trips: string[] }>();
                  
                  // Add current group's destinations
                  currentGroup.trips.forEach(trip => {
                    const destination = trip.reise.split(' - ')[0]?.trim() || trip.reise;
                    const pax = trip.buchungen || 0;
                    
                    if (!destinationMap.has(destination)) {
                      destinationMap.set(destination, { totalPax: 0, trips: [] });
                    }
                    
                    const info = destinationMap.get(destination)!;
                    info.totalPax += pax;
                    info.trips.push(trip.reisecode);
                  });
                  
                  // Add selected trips' destinations
                  selectedTripIds.forEach(tripId => {
                    const trip = candidateTrips.find(t => t.id === tripId);
                    if (trip) {
                      const destination = trip.reise.split(' - ')[0]?.trim() || trip.reise;
                      const pax = trip.buchungen || 0;
                      
                      if (!destinationMap.has(destination)) {
                        destinationMap.set(destination, { totalPax: 0, trips: [] });
                      }
                      
                      const info = destinationMap.get(destination)!;
                      info.totalPax += pax;
                      info.trips.push(trip.reisecode);
                    }
                  });

                  return (
                    <>
                      {Array.from(destinationMap.entries()).map(([dest, info]) => (
                        <div key={dest} className="p-2 border rounded-lg bg-orange-50 dark:bg-orange-950/20 text-sm">
                          <p className="font-medium">{selectedStop} → {dest}</p>
                          <p className="text-xs text-muted-foreground">
                            {info.totalPax} PAX • {info.trips.length} Reise(n)
                          </p>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg text-sm">
              <p className="font-semibold text-green-700 dark:text-green-300">
                ✅ Optimale Auslastung durch Passagier-Umverteilung!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Es werden automatisch neue Gruppen für jedes Ziel erstellt
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>
                Zurück
              </Button>
              <Button
                onClick={handleCreateHub}
                className="bg-orange-500 hover:bg-orange-600"
              >
                🔄 Hub mit {selectedTripIds.length + 1} Fahrten erstellen
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
