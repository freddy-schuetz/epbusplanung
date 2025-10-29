import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trip, Stop, BusGroup } from '@/types/bus';
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
  allBusGroups: BusGroup[];
  stops: Stop[];
  onHubCreated: () => void;
}

export const HubDialog = ({
  open,
  onClose,
  currentGroup,
  allTrips,
  allBusGroups,
  stops,
  onHubCreated,
}: HubDialogProps) => {
  const [step, setStep] = useState(1);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [candidateGroups, setCandidateGroups] = useState<BusGroup[]>([]);

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
    
    // Find ALL PLANNED bus groups passing through this stop on same day
    const date = currentGroup.trips[0].datum;
    
    const candidates = allBusGroups.filter(group => {
      // Skip current group
      if (group.id === currentGroup.id) return false;
      
      // Must be planned (has status)
      if (!group.status) return false;
      
      // Must not already be part of a hub
      if (group.hub_role) return false;
      
      // Check if any trip in this group passes through the hub stop on same date
      const groupTrips = allTrips.filter(t => t.groupId === group.id);
      if (groupTrips.length === 0) return false;
      
      // Must be same date
      if (groupTrips[0].datum !== date) return false;
      
      // Must pass through selected hub stop
      return groupTrips.some(trip => {
        const tripStops = stops.filter(s => s.Reisecode === trip.reisecode);
        return tripStops.some(s => s['Zustieg/Ausstieg'] === stopName);
      });
    });
    
    setCandidateGroups(candidates);
    setStep(2);
  };

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
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

      // Mark selected groups as incoming
      await supabase
        .from('bus_groups')
        .update({
          hub_role: 'incoming',
          hub_id: hubId,
          hub_location: selectedStop,
        })
        .in('id', selectedGroupIds);

      // Get all trips from current group and selected groups
      const allIncomingTrips = [
        ...currentGroup.trips,
        ...allTrips.filter(t => selectedGroupIds.some(gid => t.groupId === gid))
      ];

      // Group by destination for outgoing trips
      const tripsByDestination = new Map<string, Trip[]>();
      allIncomingTrips.forEach(trip => {
        const destination = trip.reise.split(' - ')[0]?.trim() || trip.reise;
        const existing = tripsByDestination.get(destination) || [];
        tripsByDestination.set(destination, [...existing, trip]);
      });

      // Create outgoing bus groups for each destination
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
          // Update trips to belong to new outgoing group
          await supabase
            .from('trips')
            .update({
              group_id: newGroup.id,
              status: 'draft',
            })
            .in('id', trips.map(t => t.id));
        }
      }

      toast.success(`Hub "${selectedStop}" erstellt mit ${selectedGroupIds.length + 1} eingehenden und ${tripsByDestination.size} ausgehenden Fahrten`);
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
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-3 rounded-lg border border-purple-500/20">
              <p className="font-semibold">Hub-Standort: {selectedStop}</p>
              <p className="text-sm text-muted-foreground">
                Datum: {currentGroup.trips[0].datum}
              </p>
            </div>

            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-3 rounded-lg border border-purple-500/20 mb-3">
              <p className="text-sm font-semibold">🚌 Geplante Busgruppen durch {selectedStop}:</p>
              <p className="text-xs text-muted-foreground mt-1">
                Wählen Sie ALLE Busgruppen - Passagiere werden automatisch neu verteilt!
              </p>
            </div>

            {candidateGroups.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ Keine anderen geplanten Busgruppen mit Halt in {selectedStop} gefunden.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {candidateGroups.map(group => {
                  const groupTrips = allTrips.filter(t => t.groupId === group.id);
                  if (groupTrips.length === 0) return null;
                  
                  // Get first and last stop for route display
                  const firstTrip = groupTrips[0];
                  const tripStops = stops.filter(s => s.Reisecode === firstTrip.reisecode);
                  const origin = tripStops[tripStops.length - 1]?.['Zustieg/Ausstieg'] || 'Start';
                  const destination = tripStops[0]?.['Zustieg/Ausstieg'] || 'Ziel';
                  const totalPax = groupTrips.reduce((sum, t) => sum + t.buchungen, 0);
                  
                  return (
                    <div
                      key={group.id}
                      className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 bg-gradient-to-r from-purple-500/5 to-pink-500/5"
                    >
                      <Checkbox
                        checked={selectedGroupIds.includes(group.id)}
                        onCheckedChange={() => handleGroupToggle(group.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-purple-500/10">
                            Fahrt {group.trip_number || 'N/A'}
                          </Badge>
                          <p className="font-medium">{origin} → {destination}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {totalPax} PAX • {groupTrips.length} Reise{groupTrips.length !== 1 ? 'n' : ''}
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">
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
                disabled={selectedGroupIds.length === 0}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                Weiter ({selectedGroupIds.length} Gruppe{selectedGroupIds.length !== 1 ? 'n' : ''} ausgewählt)
              </Button>
            </DialogFooter>
            
            {selectedGroupIds.length === 0 && candidateGroups.length > 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Mindestens 1 Busgruppe auswählen um Hub zu erstellen
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-3 rounded-lg border border-purple-500/20">
              <p className="font-semibold">🔄 Hub-Konfiguration</p>
              <p className="text-sm">Hub-Standort: {selectedStop}</p>
              <p className="text-sm">Datum: {currentGroup.trips[0].datum}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Incoming groups */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                  📥 Eingehende Busgruppen:
                </h4>
                
                {/* Current group */}
                {(() => {
                  const totalPax = currentGroup.trips.reduce((sum, t) => sum + t.buchungen, 0);
                  const firstTrip = currentGroup.trips[0];
                  const tripStops = stops.filter(s => s.Reisecode === firstTrip.reisecode);
                  const origin = tripStops[tripStops.length - 1]?.['Zustieg/Ausstieg'] || 'Start';
                  
                  return (
                    <div className="p-2 border rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-sm">
                      <Badge variant="outline" className="mb-1">Aktuelle Gruppe</Badge>
                      <p className="font-medium">{origin} → {selectedStop}</p>
                      <p className="text-xs text-muted-foreground">{totalPax} PAX</p>
                    </div>
                  );
                })()}
                
                {/* Selected groups */}
                {selectedGroupIds.map(groupId => {
                  const group = candidateGroups.find(g => g.id === groupId);
                  if (!group) return null;
                  
                  const groupTrips = allTrips.filter(t => t.groupId === group.id);
                  const totalPax = groupTrips.reduce((sum, t) => sum + t.buchungen, 0);
                  const firstTrip = groupTrips[0];
                  const tripStops = stops.filter(s => s.Reisecode === firstTrip.reisecode);
                  const origin = tripStops[tripStops.length - 1]?.['Zustieg/Ausstieg'] || 'Start';
                  
                  return (
                    <div key={group.id} className="p-2 border rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-sm">
                      <Badge variant="outline" className="mb-1">Fahrt {group.trip_number}</Badge>
                      <p className="font-medium">{origin} → {selectedStop}</p>
                      <p className="text-xs text-muted-foreground">{totalPax} PAX</p>
                    </div>
                  );
                })}
              </div>

              {/* Outgoing groups (automatically generated) */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  📤 Ausgehende Busgruppen (automatisch):
                </h4>
                {(() => {
                  // Get all incoming trips
                  const allIncomingTrips = [
                    ...currentGroup.trips,
                    ...allTrips.filter(t => selectedGroupIds.some(gid => t.groupId === gid))
                  ];
                  
                  // Group by destination
                  const destinationMap = new Map<string, { totalPax: number; trips: string[] }>();
                  
                  allIncomingTrips.forEach(trip => {
                    const destination = trip.reise.split(' - ')[0]?.trim() || trip.reise;
                    const pax = trip.buchungen || 0;
                    
                    if (!destinationMap.has(destination)) {
                      destinationMap.set(destination, { totalPax: 0, trips: [] });
                    }
                    
                    const info = destinationMap.get(destination)!;
                    info.totalPax += pax;
                    info.trips.push(trip.reisecode);
                  });

                  return (
                    <>
                      {Array.from(destinationMap.entries()).map(([dest, info]) => (
                        <div key={dest} className="p-2 border rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-sm">
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

            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-3 rounded-lg border border-green-500/20 text-sm">
              <p className="font-semibold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                ✅ Optimale Auslastung durch Passagier-Umverteilung!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Alle Passagiere werden am Hub neu auf Zielbusse verteilt
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(2)}>
                Zurück
              </Button>
              <Button
                onClick={handleCreateHub}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                🔄 Hub mit {selectedGroupIds.length + 1} eingehenden Gruppen erstellen
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
