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
    
    // Find trips passing through this stop on same day
    const date = currentGroup.trips[0].datum;
    const candidates = allTrips.filter(trip => {
      // Must be unplanned
      if (trip.planningStatus !== 'unplanned') return false;
      
      // Must be same date
      if (trip.datum !== date) return false;
      
      // Must pass through selected stop
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

            <p className="text-sm text-muted-foreground">
              Wählen Sie Fahrten, die an diesem Hub umsteigen:
            </p>

            {candidateTrips.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ Keine anderen Fahrten mit Halt in {selectedStop} gefunden.
                  Hub nicht möglich.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {candidateTrips.map(trip => (
                  <div
                    key={trip.id}
                    className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedTripIds.includes(trip.id)}
                      onCheckedChange={() => handleTripToggle(trip.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{trip.reise}</p>
                      <p className="text-sm text-muted-foreground">
                        {trip.direction === 'hin' ? '🟢 HIN' : '🔴 RÜCK'} • {trip.uhrzeit} • {trip.buchungen} PAX
                      </p>
                    </div>
                  </div>
                ))}
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

            <div className="space-y-3">
              <p className="font-semibold text-sm">Automatische Weiterfahrten von {selectedStop}:</p>
              {(() => {
                // Group trips by destination
                const destinationMap = new Map<string, { totalPax: number; trips: string[] }>();
                
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
                  <div className="space-y-2">
                    {Array.from(destinationMap.entries()).map(([dest, info]) => (
                      <div key={dest} className="p-3 border rounded-lg bg-orange-50 dark:bg-orange-950/20">
                        <p className="font-medium">✅ {selectedStop} → {dest}</p>
                        <p className="text-sm text-muted-foreground">
                          {info.totalPax} PAX • {info.trips.length} Reise(n)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {info.trips.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-sm">
              ℹ️ Es werden automatisch neue Gruppen für jedes Ziel erstellt
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>
                Zurück
              </Button>
              <Button
                onClick={handleCreateHub}
                className="bg-orange-500 hover:bg-orange-600"
              >
                🔄 Hub mit {selectedTripIds.length} Weiterfahrten erstellen
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
