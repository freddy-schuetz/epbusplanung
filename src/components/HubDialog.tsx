import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(false);

  // Pre-fill dialog if editing existing hub
  useEffect(() => {
    if (open && currentGroup) {
      // Find bus group for current group
      const busGroup = allBusGroups.find(bg => bg.id === currentGroup.id);
      
      if (busGroup?.hub_role && busGroup.hub_id && busGroup.hub_location) {
        // Editing existing hub - pre-fill data
        setSelectedStop(busGroup.hub_location);
        
        // Find all groups in this hub
        const hubGroups = allBusGroups.filter(bg => bg.hub_id === busGroup.hub_id);
        const otherHubGroupIds = hubGroups
          .filter(bg => bg.id !== currentGroup.id)
          .map(bg => bg.id);
        
        setSelectedGroupIds(otherHubGroupIds);
        
        // Find the collector
        const collector = hubGroups.find(bg => bg.hub_role === 'incoming');
        if (collector) {
          setCollectorGroupId(collector.id);
          setStep(3); // Jump to final step for editing
        }
      }
    }
  }, [open, currentGroup, allBusGroups]);

  // Find COMMON stops that appear in ALL planned groups on same day
  const getCommonStops = () => {
    const date = currentGroup.trips[0]?.datum;
    if (!date) return [];
    
    // Find all planned groups on same day (including current group)
    const sameDayGroups = allBusGroups.filter(group => {
      const groupTrips = group.id === currentGroup.id 
        ? currentGroup.trips 
        : allTrips.filter(t => t.groupId === group.id);
      
      return groupTrips.length > 0 && 
             groupTrips[0].datum === date && 
             group.status; // Must be planned
    });
    
    console.log(`[HubDialog] 🔍 Found ${sameDayGroups.length} planned groups on ${date}`);
    
    if (sameDayGroups.length < 2) {
      console.log('[HubDialog] ⚠️ Need at least 2 groups for hub');
      return [];
    }
    
    // Get stops for EACH group with start/end markers
    const groupStopsData = sameDayGroups.map(group => {
      const groupTrips = group.id === currentGroup.id 
        ? currentGroup.trips 
        : allTrips.filter(t => t.groupId === group.id);
      
      const firstTrip = groupTrips[0];
      if (!firstTrip) return { groupId: group.id, tripNumber: '', allStops: [], firstStop: null, lastStop: null };
      
      // Use global stops array filtered by reisecode (matches how GroupForm accesses stops)
      const tripStops = stops.filter(s => s.Reisecode === firstTrip.reisecode);
      
      // Filter for hin direction with valid times only
      const hinStops = tripStops.filter(s => {
        const isHinfahrt = s.Beförderung && 
          (s.Beförderung.includes('Hinfahrt') || s.Beförderung.includes('Bus Hinfahrt'));
        const hasValidTime = s.Zeit && s.Zeit.trim() !== '';
        return isHinfahrt && hasValidTime;
      });
      
      // Sort by time
      const chronologicalStops = [...hinStops].sort((a, b) => {
        const timeA = a.Zeit || '00:00';
        const timeB = b.Zeit || '00:00';
        return timeA.localeCompare(timeB);
      });
      
      const stopNames = chronologicalStops.map(s => s['Zustieg/Ausstieg']).filter(Boolean);
      const firstStop = stopNames[0];
      const lastStop = stopNames[stopNames.length - 1];
      
      console.log(`[HubDialog] 🔍 Group ${group.trip_number || group.id}:`);
      console.log(`  - Total stops in trip.stops: ${tripStops.length}`);
      console.log(`  - Hin stops with time: ${hinStops.length}`);
      console.log(`  - Chronological: ${stopNames.join(' → ')}`);
      
      return { 
        groupId: group.id,
        tripNumber: group.trip_number,
        allStops: stopNames, 
        firstStop, 
        lastStop 
      };
    });
    
    // Find INTERSECTION - stops that appear in ALL groups
    if (groupStopsData.length === 0) return [];
    
    const firstGroupStops = new Set(groupStopsData[0].allStops);
    
    // Keep only stops that appear in EVERY group
    const commonStops = [...firstGroupStops].filter(stopName => {
      // Must be in every single group
      const inAllGroups = groupStopsData.every(g => g.allStops.includes(stopName));
      
      // Exclude if it's a FIRST stop (pickup point) for any group
      const isStartPoint = groupStopsData.some(g => g.firstStop === stopName);
      
      // Exclude ONLY if it's the LAST stop for ALL groups (true final destination)
      const isEveryonesLastStop = groupStopsData.every(g => g.lastStop === stopName);
      
      return inAllGroups && !isStartPoint && !isEveryonesLastStop;
    });
    
    console.log('[HubDialog] 🔍 Intersection details:');
    groupStopsData.forEach(g => {
      console.log(`  - ${g.tripNumber}: First="${g.firstStop}" Last="${g.lastStop}"`);
    });
    console.log(`[HubDialog] 🔍 Testing each potential hub:`);
    [...firstGroupStops].forEach(stopName => {
      const inAll = groupStopsData.every(g => g.allStops.includes(stopName));
      const isStart = groupStopsData.some(g => g.firstStop === stopName);
      const isEveryonesEnd = groupStopsData.every(g => g.lastStop === stopName);
      console.log(`  - ${stopName}: inAll=${inAll}, isStart=${isStart}, isEveryonesEnd=${isEveryonesEnd} → ${inAll && !isStart && !isEveryonesEnd ? '✅ HUB' : '❌'}`);
    });
    console.log('[HubDialog] 🔍 Common stops (valid hubs):', commonStops);
    
    return commonStops;
  };
  
  const uniqueStops = getCommonStops();

  const handleStopSelect = (stopName: string) => {
    setSelectedStop(stopName);
    
    // Find ALL PLANNED bus groups passing through this stop on same day
    const date = currentGroup.trips[0].datum;
    
    const candidates = allBusGroups.filter(group => {
      // Skip current group
      if (group.id === currentGroup.id) return false;
      
      // Must be planned (has status)
      if (!group.status) return false;
      
      // Allow groups that are already in hub (to show existing state)
      
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

    const hubId = `hub-${selectedStop.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    
    try {
      setLoading(true);
      const allInvolvedGroupIds = [currentGroup.id, ...selectedGroupIds];
      
      // Helper to get stops before hub for a group
      const getStopsBeforeHubForGroup = (groupId: string) => {
        const groupTrips = groupId === currentGroup.id 
          ? currentGroup.trips 
          : allTrips.filter(t => t.groupId === groupId);
        
        if (groupTrips.length === 0) return [];
        const firstTrip = groupTrips[0];
        const tripStops = stops.filter(s => s.Reisecode === firstTrip.reisecode);
        
        // Sort by time
        const chronologicalStops = [...tripStops].sort((a, b) => {
          const timeA = a.Zeit || '';
          const timeB = b.Zeit || '';
          return timeA.localeCompare(timeB);
        });
        
        const hubIndex = chronologicalStops.findIndex(s => s['Zustieg/Ausstieg'] === selectedStop);
        if (hubIndex === -1) return [];
        
        return chronologicalStops.slice(0, hubIndex);
      };

      // 1. Calculate combined passenger counts at stops before hub
      const totalPassengersBeforeHub: { [stopName: string]: number } = {};
      
      console.log('[HubDialog] 🔍 Calculating passenger totals for stops before hub:', selectedStop);
      
      for (const gId of allInvolvedGroupIds) {
        const stopsBeforeHub = getStopsBeforeHubForGroup(gId);
        console.log(`[HubDialog] 🔍 Group ${gId} stops before hub:`, stopsBeforeHub.length);
        
        stopsBeforeHub.forEach(stop => {
          const stopName = stop['Zustieg/Ausstieg'];
          if (stopName) {
            if (!totalPassengersBeforeHub[stopName]) {
              totalPassengersBeforeHub[stopName] = 0;
            }
            totalPassengersBeforeHub[stopName] += stop.Anzahl || 0;
            console.log(`[HubDialog] 🔍 Stop "${stopName}": adding ${stop.Anzahl} PAX, total now: ${totalPassengersBeforeHub[stopName]}`);
          }
        });
      }
      
      console.log('[HubDialog] 🔍 Final passenger totals before hub:', totalPassengersBeforeHub);

      // 2. Update collector group's trips with combined passengers
      const collectorGroupTrips = collectorGroupId === currentGroup.id 
        ? currentGroup.trips 
        : allTrips.filter(t => t.groupId === collectorGroupId);
      
      for (const trip of collectorGroupTrips) {
        const tripStops = stops.filter(s => s.Reisecode === trip.reisecode);
        const chronologicalStops = [...tripStops].sort((a, b) => {
          const timeA = a.Zeit || '';
          const timeB = b.Zeit || '';
          return timeA.localeCompare(timeB);
        });
        
        // Update passenger counts for stops before hub
        const updatedStops = chronologicalStops.map(stop => {
          const stopName = stop['Zustieg/Ausstieg'];
          if (stopName && totalPassengersBeforeHub[stopName]) {
            console.log(`[HubDialog] 🔍 COLLECTOR: Updating stop "${stopName}" from ${stop.Anzahl} to ${totalPassengersBeforeHub[stopName]} PAX`);
            return { ...stop, Anzahl: totalPassengersBeforeHub[stopName] };
          }
          return stop;
        });
        
        console.log(`[HubDialog] 🔍 COLLECTOR: Saving ${updatedStops.length} stops for trip ${trip.reisecode}`);
        
        // Save updated stops to database
        const { error: tripUpdateError } = await supabase
          .from('trips')
          .update({ stops: updatedStops as any })
          .eq('id', trip.id);
          
        if (tripUpdateError) {
          console.error('Failed to update trip stops:', tripUpdateError);
          toast.error('Fehler beim Aktualisieren der Haltestellen');
          setLoading(false);
          return;
        }
        
        console.log(`[HubDialog] ✅ COLLECTOR: Stops saved successfully for trip ${trip.reisecode}`);
      }

      // 3. Update non-collector groups - remove stops before hub AND update hub stop passengers
      const nonCollectorIds = allInvolvedGroupIds.filter(id => id !== collectorGroupId);
      
      for (const gId of nonCollectorIds) {
        const groupTrips = gId === currentGroup.id 
          ? currentGroup.trips 
          : allTrips.filter(t => t.groupId === gId);
        
        for (const trip of groupTrips) {
          const tripStops = stops.filter(s => s.Reisecode === trip.reisecode);
          const chronologicalStops = [...tripStops].sort((a, b) => {
            const timeA = a.Zeit || '';
            const timeB = b.Zeit || '';
            return timeA.localeCompare(timeB);
          });
          
          const hubIndex = chronologicalStops.findIndex(s => s['Zustieg/Ausstieg'] === selectedStop);
          if (hubIndex !== -1) {
            // Keep only stops from hub onwards
            const newStops = chronologicalStops.slice(hubIndex);
            
            // Calculate passengers TRANSFERRING TO this outgoing bus:
            // This is THIS GROUP'S OWN passengers from stops before hub
            // (they board the collector, then transfer back to this bus at the hub)
            const stopsBeforeHubForThisGroup = getStopsBeforeHubForGroup(gId);
            const transferredPassengers = stopsBeforeHubForThisGroup.reduce(
              (sum, stop) => sum + (stop.Anzahl || 0), 
              0
            );
            
            console.log(`[HubDialog] 🔍 OUTGOING ${trip.reisecode}: Own passengers from stops before hub: ${transferredPassengers} PAX`);
            stopsBeforeHubForThisGroup.forEach(stop => {
              console.log(`  - ${stop['Zustieg/Ausstieg']}: ${stop.Anzahl} PAX`);
            });
            
            // Calculate own passengers at and after hub (already on this bus)
            const ownPassengersAtAndAfterHub = chronologicalStops
              .slice(hubIndex)
              .reduce((sum, stop) => sum + (stop.Anzahl || 0), 0);
            
            const combinedHubPassengers = ownPassengersAtAndAfterHub + transferredPassengers;
            
            // Update first stop (hub location) with combined passengers
            if (newStops.length > 0) {
              newStops[0] = {
                ...newStops[0],
                Anzahl: combinedHubPassengers
              };
              
              console.log(`[HubDialog] 🔍 OUTGOING: Trip ${trip.reisecode}`);
              console.log(`  - Removing ${hubIndex} stops before hub`);
              console.log(`  - Old stops count: ${chronologicalStops.length}, New stops count: ${newStops.length}`);
              console.log(`  - Own PAX at/after hub: ${ownPassengersAtAndAfterHub}`);
              console.log(`  - Transferred PAX from other groups: ${transferredPassengers}`);
              console.log(`  - Hub stop "${newStops[0]?.['Zustieg/Ausstieg']}" updated to: ${combinedHubPassengers} PAX`);
            }
            
            const { error: tripUpdateError } = await supabase
              .from('trips')
              .update({ stops: newStops as any })
              .eq('id', trip.id);
              
            if (tripUpdateError) {
              console.error('Failed to update trip stops:', tripUpdateError);
              toast.error('Fehler beim Aktualisieren der Haltestellen');
              setLoading(false);
              return;
            }
            
            console.log(`[HubDialog] ✅ OUTGOING: Stops saved successfully for trip ${trip.reisecode}`);
          }
        }
      }

      // 4. Update hub_role markers on bus_groups
      const { error: collectorError } = await supabase
        .from('bus_groups')
        .update({
          hub_role: 'incoming' as 'incoming' | 'outgoing',
          hub_id: hubId,
          hub_location: selectedStop,
        })
        .eq('id', collectorGroupId);

      if (collectorError) {
        console.error('Collector update failed:', collectorError);
        toast.error('Fehler beim Aktualisieren des Sammelbusses: ' + collectorError.message);
        setLoading(false);
        return;
      }

      if (nonCollectorIds.length > 0) {
        const { error: hubStartError } = await supabase
          .from('bus_groups')
          .update({
            hub_role: 'outgoing' as 'incoming' | 'outgoing',
            hub_id: hubId,
            hub_location: selectedStop,
          })
          .in('id', nonCollectorIds);

        if (hubStartError) {
          console.error('Hub start update failed:', hubStartError);
          toast.error('Fehler beim Aktualisieren der Hub-Busse: ' + hubStartError.message);
          setLoading(false);
          return;
        }
      }

      // Success - update local state via callback
      console.log('[HubDialog] ✅ Hub creation complete - verifying database updates...');
      
      // Verify database updates
      for (const gId of allInvolvedGroupIds) {
        const groupTrips = gId === currentGroup.id 
          ? currentGroup.trips 
          : allTrips.filter(t => t.groupId === gId);
        
        for (const trip of groupTrips) {
          const { data: verifyTrip } = await supabase
            .from('trips')
            .select('stops, reisecode')
            .eq('id', trip.id)
            .single();
          
          if (verifyTrip) {
            const stopsArray = Array.isArray(verifyTrip.stops) ? verifyTrip.stops : [];
            console.log(`[HubDialog] ✅ VERIFY: ${verifyTrip.reisecode} has ${stopsArray.length} stops in DB`);
            if (stopsArray.length > 0) {
              const firstStop = stopsArray[0] as any;
              console.log(`[HubDialog] ✅ VERIFY: First stop: "${firstStop['Zustieg/Ausstieg']}" with ${firstStop.Anzahl} PAX`);
            }
          }
        }
      }
      
      toast.success(`Hub "${selectedStop}" erfolgreich erstellt - Haltestellen aktualisiert`);
      
      // Trigger parent refresh to update stops
      if (onHubCreated) {
        console.log('[HubDialog] 🔄 Triggering parent refresh...');
        await onHubCreated();
      }
      
      // Close dialog
      handleClose();
      
    } catch (error) {
      console.error('Error creating hub:', error);
      toast.error('Fehler beim Erstellen des Hubs');
    } finally {
      setLoading(false);
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
              Wählen Sie eine gemeinsame Haltestelle als Umsteigepunkt:
            </p>
            {uniqueStops.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
                  ⚠️ Keine gemeinsamen Haltestellen gefunden
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Für einen Hub werden mindestens 2 geplante Busgruppen am selben Tag benötigt, die eine gemeinsame Haltestelle haben (außer Start/Ziel).
                </p>
              </div>
            ) : (
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
            )}
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
                          {group.hub_role && (
                            <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">
                              (bereits im Hub)
                            </span>
                          )}
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

              // Helper to extract destination from trip name or stops
              const getDestination = (groupId: string) => {
                const groupTrips = groupId === currentGroup.id 
                  ? currentGroup.trips 
                  : allTrips.filter(t => t.groupId === groupId);
                
                if (groupTrips.length === 0) return 'Ziel';
                
                const firstTrip = groupTrips[0];
                const tripName = firstTrip.reisecode || '';
                
                // Common destination mappings from trip codes
                if (tripName.includes('SSL') || tripName.includes('Saalbach')) return 'Saalbach';
                if (tripName.includes('SVS') || tripName.includes('Scoul')) return 'Scoul';
                if (tripName.includes('DPW') || tripName.includes('Davos')) return 'Davos';
                
                // Fallback: get last stop chronologically
                const tripStops = stops.filter(s => s.Reisecode === firstTrip.reisecode);
                const chronologicalStops = [...tripStops].sort((a, b) => {
                  const timeA = a.Zeit || '';
                  const timeB = b.Zeit || '';
                  return timeA.localeCompare(timeB);
                });
                
                return chronologicalStops[chronologicalStops.length - 1]?.['Zustieg/Ausstieg'] || 'Ziel';
              };

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
                      
                      // Get first stop before hub as origin
                      const stopsBeforeHub = getStopsBeforeHub(groupId);
                      const origin = stopsBeforeHub.length > 0 
                        ? stopsBeforeHub[0] 
                        : 'Start';
                      
                      // Get final destination using helper
                      const destination = getDestination(groupId);
                      
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
                      disabled={!collectorGroupId || loading}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      {loading ? 'Erstelle Hub...' : '🔄 Hub erstellen'}
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
