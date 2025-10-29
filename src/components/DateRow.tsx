import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GroupCard } from './GroupCard';
import { TripCard } from './TripCard';
import { DropZone } from './DropZone';
import { Trip, Stop, BusGroup } from '@/types/bus';

interface DateRowProps {
  date: string;
  weekday: string;
  isToday: boolean;
  plannedGroups: Array<{ groupId: string; trips: Trip[]; displayMode?: 'departure' | 'return' }>;
  hinfahrten: Trip[];
  rueckfahrten: Trip[];
  nextDayKey: string;
  stops: Stop[];
  allTrips: Trip[];
  allBusGroups: BusGroup[];
  selectedTrips: Set<string>;
  onToggleSelection: (tripId: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<Trip>) => void;
  onCompleteGroup: (groupId: string) => void;
  onSetGroupToDraft: (groupId: string) => void;
  onLockGroup: (groupId: string) => void;
  onUnlockGroup: (groupId: string) => void;
  onDissolveGroup: (groupId: string) => void;
  onSplitGroup: (groupId: string, splitGroups: any[]) => void;
  onHubCreated: () => void;
}

export const DateRow = ({
  date,
  weekday,
  isToday,
  plannedGroups,
  hinfahrten,
  rueckfahrten,
  nextDayKey,
  stops,
  allTrips,
  allBusGroups,
  selectedTrips,
  onToggleSelection,
  onUpdateGroup,
  onCompleteGroup,
  onSetGroupToDraft,
  onLockGroup,
  onUnlockGroup,
  onDissolveGroup,
  onSplitGroup,
  onHubCreated,
}: DateRowProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Sort trips by product code for better visual grouping
  const sortedHinfahrten = [...hinfahrten].sort((a, b) => {
    // First by product code (DWW, DKI, etc.)
    const codeA = a.produktcode || '';
    const codeB = b.produktcode || '';
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    
    // Then by time within same product code
    return (a.uhrzeit || '').localeCompare(b.uhrzeit || '');
  });

  const sortedRueckfahrten = [...rueckfahrten].sort((a, b) => {
    // First by product code
    const codeA = a.produktcode || '';
    const codeB = b.produktcode || '';
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    
    // Then by time within same product code
    return (a.uhrzeit || '').localeCompare(b.uhrzeit || '');
  });

  return (
    <div className="bg-card border-2 border-border rounded-xl overflow-hidden mb-8">
      <div
        className={`${isToday ? 'gradient-today border-b-4 border-success' : 'gradient-date'} p-4 cursor-pointer select-none flex items-center justify-between`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg">
            📅 {weekday}, {date}
          </span>
          {isToday && (
            <span className="bg-success text-success-foreground px-3 py-1 rounded text-xs font-bold">
              HEUTE
            </span>
          )}
        </div>
        <div className="flex items-center gap-5">
          <span className="text-sm">🚌 {plannedGroups.length} Planungen</span>
          <span className="text-sm">🟢 {hinfahrten.length} Hinfahrten</span>
          <span className="text-sm">🔴 {rueckfahrten.length} Rückfahrten</span>
          <ChevronDown className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="bg-primary/5 p-4 border-b-2 border-primary/20">
            <DropZone id={`dropzone-${date}`} label="🚌 Neue Busplanung erstellen" />
            
            {plannedGroups.length > 0 && (
              <>
                <div className="text-primary font-semibold text-xs uppercase mb-3">
                  🚌 Geplante Busfahrten
                </div>
                {plannedGroups.map(group => (
                  <GroupCard
                    key={`${group.groupId}-${group.displayMode || 'departure'}`}
                    groupId={group.groupId}
                    trips={group.trips}
                    stops={stops}
                    allTrips={allTrips}
                    allBusGroups={allBusGroups}
                    displayMode={group.displayMode}
                    onUpdateGroup={onUpdateGroup}
                    onCompleteGroup={onCompleteGroup}
                    onSetGroupToDraft={onSetGroupToDraft}
                    onLockGroup={onLockGroup}
                    onUnlockGroup={onUnlockGroup}
                    onDissolveGroup={onDissolveGroup}
                    onSplitGroup={onSplitGroup}
                    onHubCreated={onHubCreated}
                  />
                ))}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 bg-muted/30">
            <div className="bg-card rounded-lg p-3 border">
              <div className="bg-success/10 text-success font-semibold p-2 rounded-lg mb-3 text-center border border-success/30 text-sm">
                🟢 Hinfahrten {date}
              </div>
              <div className="space-y-2">
                {sortedHinfahrten.length > 0 ? (
                  sortedHinfahrten.map(trip => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      stops={stops}
                      isSelected={selectedTrips.has(trip.id)}
                      onToggleSelection={onToggleSelection}
                    />
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Keine ungeplanten Hinfahrten
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card rounded-lg p-3 border">
              <div className="bg-destructive/10 text-destructive font-semibold p-2 rounded-lg mb-3 text-center border border-destructive/30 text-sm">
                🔴 Rückfahrten {nextDayKey}
              </div>
              <div className="space-y-2">
                {sortedRueckfahrten.length > 0 ? (
                  sortedRueckfahrten.map(trip => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      stops={stops}
                      isSelected={selectedTrips.has(trip.id)}
                      onToggleSelection={onToggleSelection}
                    />
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Keine ungeplanten Rückfahrten
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
