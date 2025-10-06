import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { GroupForm } from './GroupForm';
import { Trip, Bus, BusGroup, Stop } from '@/types/bus';
import { fetchBuses } from '@/lib/supabaseOperations';
import { supabase } from '@/integrations/supabase/client';

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
}: GroupCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [busGroup, setBusGroup] = useState<BusGroup | null>(null);
  const firstTrip = trips[0];
  const totalPassengers = trips.reduce((sum, t) => sum + t.buchungen, 0);
  const hasHin = trips.some(t => t.direction === 'hin');
  const hasRueck = trips.some(t => t.direction === 'rueck');
  const directionText = hasHin && hasRueck ? '↔️ HIN+RÜCK' : hasHin ? '🟢 HIN' : '🔴 RÜCK';

  useEffect(() => {
    fetchBuses().then(setBuses).catch(console.error);
    
    // Fetch bus group data to get trip_number
    const fetchBusGroup = async () => {
      const { data } = await supabase
        .from('bus_groups')
        .select('*')
        .eq('id', groupId)
        .single();
      
      if (data) setBusGroup(data);
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
    <div className="bg-card border-2 border-primary/30 rounded-lg overflow-hidden mb-3 shadow-sm">
      <div
        className="gradient-primary text-white p-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">🚌 Busplanung</span>
          {busGroup?.trip_number && (
            <span className="bg-white/30 px-3 py-1 rounded font-bold">
              Fahrt-Nr: {busGroup.trip_number}
            </span>
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
        <div className="bg-muted/30 p-5">
          <GroupForm
            groupId={groupId}
            trips={trips}
            stops={stops}
            onUpdateGroup={onUpdateGroup}
            onCompleteGroup={onCompleteGroup}
            onSetGroupToDraft={onSetGroupToDraft}
            onDissolveGroup={onDissolveGroup}
          />
        </div>
      )}
    </div>
  );
};
