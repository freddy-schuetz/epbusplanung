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
  const [collectorGroupId, setCollectorGroupId] = useState<string | null>(null);

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
    if (!selectedStop || !collectorGroupId) return;

    const hubId = `hub-${selectedStop.toLowerCase().replace(/\s+/g, '-')}-${currentGroup.trips[0].datum}-${Date.now()}`;
    
    try {
      const allInvolvedGroupIds = [currentGroup.id, ...selectedGroupIds];
      
      // Update collector group
      const { error: collectorError } = await supabase
        .from('bus_groups')
        .update({
          hub_role: 'collector' as 'collector' | 'hub_start',
          hub_id: hubId,
          hub_location: selectedStop,
        })
        .eq('id', collectorGroupId);

      if (collectorError) throw collectorError;

      // Update non-collector groups as hub_start (they start at hub)
      const nonCollectorIds = allInvolvedGroupIds.filter(id => id !== collectorGroupId);
      if (nonCollectorIds.length > 0) {
        const { error: hubStartError } = await supabase
          .from('bus_groups')
          .update({
            hub_role: 'hub_start' as 'collector' | 'hub_start',
            hub_id: hubId,
            hub_location: selectedStop,
          })
          .in('id', nonCollectorIds);

        if (hubStartError) throw hubStartError;
      }

      toast.success(`Hub "${selectedStop}" erfolgreich erstellt mit ${allInvolvedGroupIds.length} Busgruppen`);
      handleClose();
      window.location.reload();
      
    } catch (error) {
      console.error('Error creating hub:', error);
      toast.error('Fehler beim Erstellen des Hubs');
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedStop(null);
    setSelectedGroupIds([]);
    setCandidateGroups([]);
    setCollectorGroupId(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
                  
                  // Get first and last stop for route display - sort by time
                  const firstTrip = groupTrips[0];
                  const tripStops = stops.filter(s => s.Reisecode === firstTrip.reisecode);
                  const chronologicalStops = [...tripStops].sort((a, b) => {
                    const timeA = a.Zeit || '';
                    const timeB = b.Zeit || '';
                    return timeA.localeCompare(timeB);
                  });
                  const origin = chronologicalStops[0]?.['Zustieg/Ausstieg'] || 'Start';
                  const destination = chronologicalStops[chronologicalStops.length - 1]?.['Zustieg/Ausstieg'] || 'Ziel';
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
              <p className="font-semibold">🔄 Hub-Konfiguration - {selectedStop}</p>
              <p className="text-sm text-muted-foreground">Datum: {currentGroup.trips[0].datum}</p>
            </div>

            {(() => {
              // Get all groups involved (current + selected)
              const allInvolvedGroupIds = [
                currentGroup.id,
                ...selectedGroupIds
              ];

              // Find common stops BEFORE hub (chronologically sorted by time)
              const getStopsBeforeHub = (groupId: string) => {
                const groupTrips = groupId === currentGroup.id 
                  ? currentGroup.trips 
                  : allTrips.filter(t => t.groupId === groupId);
                
                if (groupTrips.length === 0) return [];
                const firstTrip = groupTrips[0];
                const tripStops = stops.filter(s => s.Reisecode === firstTrip.reisecode);
                
                // Sort stops by Zeit (time) to get correct chronological order
                const chronologicalStops = [...tripStops].sort((a, b) => {
                  const timeA = a.Zeit || '';
                  const timeB = b.Zeit || '';
                  return timeA.localeCompare(timeB);
                });
                
                const hubIndex = chronologicalStops.findIndex(s => s['Zustieg/Ausstieg'] === selectedStop);
                if (hubIndex === -1) return [];
                
                // Return only stops BEFORE hub (chronologically)
                return chronologicalStops.slice(0, hubIndex).map(s => s['Zustieg/Ausstieg']).filter(Boolean);
              };

              const commonStopsBeforeHub = (() => {
                const stopSets = allInvolvedGroupIds.map(id => new Set(getStopsBeforeHub(id)));
                if (stopSets.length === 0) return [];
                const firstSet = stopSets[0];
                const common = Array.from(firstSet).filter(stop => 
                  stopSets.every(set => set.has(stop))
                );
                return common;
              })();

              return (
                <>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Wählen Sie den Sammelbus:</h4>
                    <p className="text-xs text-muted-foreground">
                      Dieser Bus sammelt alle Passagiere von gemeinsamen Haltestellen vor {selectedStop}
                    </p>

                    {commonStopsBeforeHub.length > 0 && (
                      <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20 text-xs">
                        <p className="font-medium">📍 Gemeinsame Haltestellen vor Hub: {commonStopsBeforeHub.join(', ')}</p>
                      </div>
                    )}

                    {allInvolvedGroupIds.map(groupId => {
                      const groupTrips = groupId === currentGroup.id ? currentGroup.trips : allTrips.filter(t => t.groupId === groupId);
                      const totalPax = groupTrips.reduce((sum, t) => sum + t.buchungen, 0);
                      const firstTrip = groupTrips[0];
                      const tripStops = stops.filter(s => s.Reisecode === firstTrip.reisecode);
                      
                      // Sort stops by Zeit (time) to get correct chronological order
                      const chronologicalStops = [...tripStops].sort((a, b) => {
                        const timeA = a.Zeit || '';
                        const timeB = b.Zeit || '';
                        return timeA.localeCompare(timeB);
                      });
                      
                      // Get first stop before hub as origin
                      const stopsBeforeHub = getStopsBeforeHub(groupId);
                      const origin = stopsBeforeHub.length > 0 
                        ? stopsBeforeHub[0] 
                        : chronologicalStops[0]?.['Zustieg/Ausstieg'] || 'Start';
                      
                      // Get final destination (last stop in chronological order)
                      const destination = chronologicalStops[chronologicalStops.length - 1]?.['Zustieg/Ausstieg'] || 'Ziel';
                      
                      const isCollector = collectorGroupId === groupId;
                      const busGroup = allBusGroups.find(bg => bg.id === groupId);
                      const tripNumber = busGroup?.trip_number || 'N/A';

                      return (
                        <div
                          key={groupId}
                          onClick={() => setCollectorGroupId(groupId)}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            isCollector 
                              ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500' 
                              : 'bg-muted/30 hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                              isCollector ? 'border-purple-500 bg-purple-500' : 'border-muted-foreground'
                            }`}>
                              {isCollector && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={isCollector ? 'bg-purple-500/20' : ''}>
                                  Bus {tripNumber}
                                </Badge>
                                <p className="font-medium text-sm">{origin} → {destination}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {totalPax} PAX • {groupTrips.length} Reise{groupTrips.length !== 1 ? 'n' : ''}
                              </p>
                              {isCollector && (
                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                  ✅ Sammelt alle Passagiere {commonStopsBeforeHub.length > 0 ? `von ${commonStopsBeforeHub.join(', ')}` : 'vor Hub'}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {collectorGroupId && (
                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-3 rounded-lg border border-green-500/20 text-sm">
                      <p className="font-semibold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        ✅ Passagier-Umverteilung konfiguriert
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Der gewählte Sammelbus holt alle Passagiere ab. Andere Busse starten am Hub.
                      </p>
                    </div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setCollectorGroupId(null);
                      setStep(2);
                    }}>
                      Zurück
                    </Button>
                    <Button
                      onClick={handleCreateHub}
                      disabled={!collectorGroupId}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      🔄 Hub erstellen
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
