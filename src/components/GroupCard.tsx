import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GroupForm } from './GroupForm';
import { Trip, Bus, BusGroup, Stop } from '@/types/bus';
import { fetchBuses } from '@/lib/supabaseOperations';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GroupCardProps {
  groupId: string;
  trips: Trip[];
  stops: Stop[];
  displayMode?: 'departure' | 'return';
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
  displayMode = 'departure',
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
  const hasHin = trips.some(t => t.direction === 'hin');
  const hasRueck = trips.some(t => t.direction === 'rueck');
  const directionText = hasHin && hasRueck ? '↔️ HIN+RÜCK' : hasHin ? '🟢 HIN' : '🔴 RÜCK';
  
  // Calculate PAX per direction
  const hinTrips = trips.filter(t => t.direction === 'hin');
  const rueckTrips = trips.filter(t => t.direction === 'rueck');
  const hinPax = hinTrips.reduce((sum, t) => sum + t.buchungen, 0);
  const rueckPax = rueckTrips.reduce((sum, t) => sum + t.buchungen, 0);
  
  const isSplitGroup = busGroup && busGroup.total_parts > 1;

  // Check for Standbus (bus stays on-site for >2 days)
  
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

    // Helper to get destination with product codes
    const getDestinationWithCodes = (trips: Trip[]) => {
      const destination = extractDestination(trips[0].reise);
      const productCodes = [...new Set(
        trips.map(t => t.produktcode?.substring(0, 3).toUpperCase()).filter(Boolean)
      )].join('/');
      return `${destination} (${productCodes})`;
    };

    // Build Hinfahrt route with all stops
    let hinRoute = null;
    if (hasHin) {
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
      
      // Get unique stop names in chronological order
      const stopNames = [...new Set(sortedHinStops.slice(0, -1).map(s => s['Zustieg/Ausstieg']))];
      const destination = getDestinationWithCodes(hinTrips);
      
      if (sortedHinStops.length > 0) {
        const firstTime = sortedHinStops[0].Zeit || '';
        const firstStop = stopNames[0];
        const middleStops = stopNames.slice(1);
        
        hinRoute = (
          <>
            <span>↗ </span>
            <span className="font-bold">{firstTime} {firstStop}</span>
            {middleStops.map((stop, idx) => (
              <span key={idx}>
                <span> → </span>
                <span className="text-sm font-normal opacity-80">{stop}</span>
              </span>
            ))}
            <span> → </span>
            <span className="font-bold">{destination}</span>
          </>
        );
      }
    }

    // Build Rückfahrt route with all stops in reverse geographic order
    let rueckRoute = null;
    if (hasRueck) {
      const rueckStops = stops.filter(stop => 
        rueckTrips.some(trip => trip.reisecode === stop.Reisecode) &&
        stop.Zeit && stop.Zeit.trim() !== ''
      );
      
      // Sort stops by time for geographic order
      const sortedRueckStops = rueckStops.sort((a, b) => {
        const timeA = a.Zeit || '00:00';
        const timeB = b.Zeit || '00:00';
        
        const [hoursA] = timeA.split(':').map(Number);
        const [hoursB] = timeB.split(':').map(Number);
        
        const dateA = hoursA < 6 ? 1 : 0;
        const dateB = hoursB < 6 ? 1 : 0;
        
        if (dateA !== dateB) return dateA - dateB;
        return timeA.localeCompare(timeB);
      });
      
      // Get unique stop names
      const stopNames = [...new Set(sortedRueckStops.map(s => s['Zustieg/Ausstieg']))];
      const origin = getDestinationWithCodes(rueckTrips);
      
      if (sortedRueckStops.length > 0) {
        const firstStop = origin;
        const middleStops = stopNames.slice(0, -1);
        const lastStop = stopNames[stopNames.length - 1];
        
        rueckRoute = (
          <>
            <span>↘ </span>
            <span className="font-bold">{firstStop}</span>
            {middleStops.map((stop, idx) => (
              <span key={idx}>
                <span> → </span>
                <span className="text-sm font-normal opacity-80">{stop}</span>
              </span>
            ))}
            <span> → </span>
            <span className="font-bold">{lastStop}</span>
          </>
        );
      }
    }

    return {
      ...(hinRoute && { hin: hinRoute }),
      ...(rueckRoute && { rueck: rueckRoute })
    };
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


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return '📝';
      case 'completed': return '✅';
      case 'locked': return '🔒';
      default: return '❓';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Entwurf';
      case 'completed': return 'Fertig';
      case 'locked': return 'Gesperrt';
      default: return 'Ungeplant';
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden mb-2 shadow-sm hover:shadow-md transition-shadow ${
      isStandbus ? 'bg-orange-50/50 border-orange-300' : 'bg-card border-border'
    }`}>
      <div
        className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Trip number with icon */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-lg">🚌</span>
          {busGroup?.trip_number && (
            <span className="font-bold text-sm">{busGroup.trip_number}</span>
          )}
        </div>

        {/* Split indicator */}
        {isSplitGroup && (
          <Badge variant="secondary" className="text-xs shrink-0">
            Teil {busGroup.part_number}/{busGroup.total_parts}
          </Badge>
        )}

        {/* Standbus indicator */}
        {isStandbus && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs shrink-0 border-orange-500 text-orange-600">
                  🅿️
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Standbus ({standbusDays} Tage)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Routes - inline display */}
        {routeDisplays && (
          <div className="flex-1 flex items-center gap-2 text-xs overflow-hidden">
            {routeDisplays.hin && (
              <span className="inline-flex items-center gap-1 shrink-0">
                {routeDisplays.hin}
              </span>
            )}
            {routeDisplays.hin && routeDisplays.rueck && (
              <span className="text-muted-foreground">|</span>
            )}
            {routeDisplays.rueck && (
              <span className="inline-flex items-center gap-1 shrink-0">
                {routeDisplays.rueck}
              </span>
            )}
          </div>
        )}

        {/* PAX compact */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          {hinPax > 0 && (
            <span className="font-medium">↗{hinPax}</span>
          )}
          {rueckPax > 0 && (
            <span className="font-medium">↘{rueckPax}</span>
          )}
        </div>

        {/* Bus name */}
        {busInfo && (
          <Badge variant="outline" className="text-xs shrink-0">
            {busInfo}
          </Badge>
        )}

        {/* Status icon */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-lg shrink-0 cursor-pointer">
                {getStatusIcon(firstTrip.planningStatus)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getStatusText(firstTrip.planningStatus)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Expand chevron */}
        <ChevronDown 
          className={`w-4 h-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
        />
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
