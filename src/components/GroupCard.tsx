import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import { GroupForm } from './GroupForm';
import { Trip, Bus, BusGroup, Stop } from '@/types/bus';
import { fetchBuses } from '@/lib/supabaseOperations';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GroupCardProps {
  groupId: string;
  trips: Trip[];
  stops: Stop[];
  onUpdateGroup: (groupId: string, updates: Partial<Trip>) => void;
  onCompleteGroup: (groupId: string) => void;
  onSetGroupToDraft: (groupId: string) => void;
  onLockGroup: (groupId: string) => void;
  onUnlockGroup: (groupId: string) => void;
  onDissolveGroup: (groupId: string) => void;
  onSplitGroup: (groupId: string, splitGroups: any[]) => void;
}

export const GroupCard = ({
  groupId,
  trips,
  stops,
  onUpdateGroup,
  onCompleteGroup,
  onSetGroupToDraft,
  onLockGroup,
  onUnlockGroup,
  onDissolveGroup,
  onSplitGroup,
}: GroupCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [busGroup, setBusGroup] = useState<BusGroup | null>(null);
  const [linkedGroups, setLinkedGroups] = useState<BusGroup[]>([]);
  const firstTrip = trips[0];
  const totalPassengers = trips.reduce((sum, t) => sum + t.buchungen, 0);
  const hasHin = trips.some(t => t.direction === 'hin');
  const hasRueck = trips.some(t => t.direction === 'rueck');
  const directionText = hasHin && hasRueck ? '↔️ HIN+RÜCK' : hasHin ? '🟢 HIN' : '🔴 RÜCK';
  
  const isSplitGroup = busGroup && busGroup.total_parts > 1;

  // Check for Standbus (bus stays on-site for >2 days)
  const hinTrips = trips.filter(t => t.direction === 'hin');
  const rueckTrips = trips.filter(t => t.direction === 'rueck');
  
  let isStandbus = false;
  let standbusDays = 0;
  let hinDate: Date | null = null;
  let rueckDate: Date | null = null;
  
  if (hinTrips.length > 0 && rueckTrips.length > 0) {
    const [hinDay, hinMonth, hinYear] = hinTrips[0].datum.split('.').map(Number);
    const [rueckDay, rueckMonth, rueckYear] = rueckTrips[0].datum.split('.').map(Number);
    hinDate = new Date(hinYear, hinMonth - 1, hinDay);
    rueckDate = new Date(rueckYear, rueckMonth - 1, rueckDay);
    standbusDays = Math.floor((rueckDate.getTime() - hinDate.getTime()) / (1000 * 60 * 60 * 24));
    isStandbus = standbusDays > 2;
  }

  // Extract destination from trip name (e.g., "Davos - Sportclub Weissfluh" → "Davos")
  const extractDestination = (tripName: string) => {
    const parts = tripName.split(' - ');
    return parts[0]?.trim() || 'Ziel';
  };

  // Calculate route displays for both directions
  const calculateRoutes = () => {
    if (!hasHin && !hasRueck) return null;

    const hinPax = hinTrips.reduce((sum, t) => sum + t.buchungen, 0);
    const rueckPax = rueckTrips.reduce((sum, t) => sum + t.buchungen, 0);

    // Get destination from first trip
    const destination = extractDestination(trips[0].reise);

    // Find first stop from Hinfahrt with proper sorting for overnight trips
    const hinStops = stops.filter(stop => 
      hinTrips.some(trip => trip.reisecode === stop.Reisecode) &&
      stop.Zeit && stop.Zeit.trim() !== ''
    );
    
    // Sort stops by time, treating early morning (00:00-05:59) as next day
    const sortedHinStops = hinStops.sort((a, b) => {
      const timeA = a.Zeit || '00:00';
      const timeB = b.Zeit || '00:00';
      
      const [hoursA] = timeA.split(':').map(Number);
      const [hoursB] = timeB.split(':').map(Number);
      
      // Early morning times (00:00-05:59) are next day
      const dateA = hoursA < 6 ? 1 : 0;
      const dateB = hoursB < 6 ? 1 : 0;
      
      // First compare dates, then times
      if (dateA !== dateB) return dateA - dateB;
      return timeA.localeCompare(timeB);
    });
    
    const firstStop = sortedHinStops.length > 0 ? sortedHinStops[0]['Zustieg/Ausstieg'] : 'Start';

    if (hasHin && hasRueck) {
      // Both directions
      return {
        hin: `↗ ${firstStop} → ${destination} (${hinPax} PAX)`,
        rueck: `↘ ${destination} → ${firstStop} (${rueckPax} PAX)`
      };
    } else if (hasHin) {
      return { hin: `${firstStop} → ${destination}` };
    } else {
      return { rueck: `${destination} → ${firstStop}` };
    }
  };

  const routeDisplays = calculateRoutes();

  useEffect(() => {
    fetchBuses().then(setBuses).catch(console.error);
    
    // Fetch bus group data to get trip_number and split info
    const fetchBusGroup = async () => {
      const { data } = await supabase
        .from('bus_groups')
        .select('*')
        .eq('id', groupId)
        .single();
      
      if (data) {
        setBusGroup(data);
        
        // If this is a split group, fetch linked groups
        if (data.split_group_id) {
          const { data: linked } = await supabase
            .from('bus_groups')
            .select('*')
            .eq('split_group_id', data.split_group_id)
            .neq('id', groupId);
          
          if (linked) setLinkedGroups(linked);
        }
      }
    };
    
    fetchBusGroup();
  }, [groupId]);
  
  let busInfo = '';
  if (firstTrip.busDetails?.busId) {
    const bus = buses.find(b => b.id === firstTrip.busDetails!.busId);
    if (bus) busInfo = bus.name;
  }

  const renderActions = () => {
    const status = firstTrip.planningStatus;
    
    if (status === 'draft') {
      return (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onCompleteGroup(groupId); }} className="gradient-primary">
          ✅ Fertig
        </Button>
      );
    } else if (status === 'completed') {
      return (
        <>
          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onSetGroupToDraft(groupId); }}>
            ↩️ Entwurf
          </Button>
          <Button size="sm" className="bg-warning text-warning-foreground" onClick={(e) => { e.stopPropagation(); onLockGroup(groupId); }}>
            🔒 Sperren
          </Button>
        </>
      );
    } else if (status === 'locked') {
      return (
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onUnlockGroup(groupId); }}>
          🔓 Entsperren
        </Button>
      );
    }
    return null;
  };

  return (
    <div className={`border-2 rounded-lg overflow-hidden mb-3 shadow-sm ${
      isStandbus ? 'bg-orange-50 border-orange-300' : 'bg-card border-primary/30'
    }`}>
      <div
        className={`text-white p-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity ${
          isStandbus ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 'gradient-primary'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">🚌 Busplanung</span>
          {busGroup?.trip_number && (
            <span className="bg-white/30 px-3 py-1 rounded font-bold">
              Fahrt-Nr: {busGroup.trip_number}
            </span>
          )}
          {isSplitGroup && (
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white">
              Teil {busGroup.part_number}/{busGroup.total_parts}
            </Badge>
          )}
          {isStandbus && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge className="bg-white/90 hover:bg-white text-orange-600 font-bold">
                    🅿️ STANDBUS
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bus bleibt {standbusDays} Tage vor Ort</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {routeDisplays && (
            <div className="flex flex-col gap-1">
              {routeDisplays.hin && (
                <span className="bg-white/20 px-3 py-1 rounded font-semibold text-sm">
                  {routeDisplays.hin}
                </span>
              )}
              {routeDisplays.rueck && (
                <span className="bg-white/20 px-3 py-1 rounded font-semibold text-sm">
                  {routeDisplays.rueck}
                </span>
              )}
            </div>
          )}
          <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold">{directionText}</span>
          <span className="opacity-90">
            <StatusBadge status={firstTrip.planningStatus} />
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">{trips.length} Reise{trips.length !== 1 ? 'n' : ''}</span>
          <span className="text-sm">{totalPassengers} PAX</span>
          {busInfo && <span className="text-sm">{busInfo}</span>}
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {renderActions()}
          </div>
          <ChevronDown className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>
      
      {isExpanded && (
        <div className="bg-muted/30 p-5 space-y-4">
          {isSplitGroup && linkedGroups.length > 0 && (
            <div className="bg-card border-2 border-orange-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔗</span>
                <h4 className="font-semibold">Verbundene Busse:</h4>
              </div>
              <div className="space-y-2">
                {linkedGroups.map(linked => (
                  <div key={linked.id} className="text-sm flex items-center gap-2">
                    <Badge variant="outline">Teil {linked.part_number}/{linked.total_parts}</Badge>
                    <span>Fahrt-Nr: {linked.trip_number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <GroupForm
            groupId={groupId}
            trips={trips}
            stops={stops}
            onUpdateGroup={onUpdateGroup}
            onCompleteGroup={onCompleteGroup}
            onSetGroupToDraft={onSetGroupToDraft}
            onDissolveGroup={onDissolveGroup}
            onSplitGroup={onSplitGroup}
          />
        </div>
      )}
    </div>
  );
};
