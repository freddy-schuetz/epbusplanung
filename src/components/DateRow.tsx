import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GroupCard } from './GroupCard';
import { TripCard } from './TripCard';
import { DropZone } from './DropZone';
import { Trip, Stop } from '@/types/bus';

interface DateRowProps {
  date: string;
  weekday: string;
  isToday: boolean;
  plannedGroups: Array<{ groupId: string; trips: Trip[] }>;
  hinfahrten: Trip[];
  rueckfahrten: Trip[];
  nextDayKey: string;
  stops: Stop[];
  selectedTrips: Set<string>;
  onToggleSelection: (tripId: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<Trip>) => void;
  onCompleteGroup: (groupId: string) => void;
  onSetGroupToDraft: (groupId: string) => void;
  onLockGroup: (groupId: string) => void;
  onUnlockGroup: (groupId: string) => void;
  onDissolveGroup: (groupId: string) => void;
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
  selectedTrips,
  onToggleSelection,
  onUpdateGroup,
  onCompleteGroup,
  onSetGroupToDraft,
  onLockGroup,
  onUnlockGroup,
  onDissolveGroup,
}: DateRowProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

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
                    key={group.groupId}
                    groupId={group.groupId}
                    trips={group.trips}
                    stops={stops}
                    onUpdateGroup={onUpdateGroup}
                    onCompleteGroup={onCompleteGroup}
                    onSetGroupToDraft={onSetGroupToDraft}
                    onLockGroup={onLockGroup}
                    onUnlockGroup={onUnlockGroup}
                    onDissolveGroup={onDissolveGroup}
                  />
                ))}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5 bg-muted/30">
            <div className="bg-card rounded-lg p-4 border">
              <div className="bg-success/10 text-success font-semibold p-3 rounded-lg mb-4 text-center border border-success/30">
                🟢 Hinfahrten {date}
              </div>
              <div className="space-y-3">
                {hinfahrten.length > 0 ? (
                  hinfahrten.map(trip => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
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

            <div className="bg-card rounded-lg p-4 border">
              <div className="bg-destructive/10 text-destructive font-semibold p-3 rounded-lg mb-4 text-center border border-destructive/30">
                🔴 Rückfahrten {nextDayKey}
              </div>
              <div className="space-y-3">
                {rueckfahrten.length > 0 ? (
                  rueckfahrten.map(trip => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
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
