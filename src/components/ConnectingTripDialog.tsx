import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trip, BusGroup } from '@/types/bus';
import { parseGermanDate, formatDate } from '@/lib/dateUtils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConnectingTripDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: BusGroup;
  currentTrips: Trip[];
  allTrips: Trip[];
  onSave: (targetGroupId: string) => void;
}

export const ConnectingTripDialog = ({
  isOpen,
  onClose,
  currentGroup,
  currentTrips,
  allTrips,
  onSave,
}: ConnectingTripDialogProps) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [potentialTrips, setPotentialTrips] = useState<Trip[]>([]);

  // Extract destination from trip name
  const extractDestination = (tripName: string) => {
    const parts = tripName.split(' - ');
    return parts[0]?.trim() || '';
  };

  // Extract origin from trip name
  const extractOrigin = (tripName: string) => {
    const parts = tripName.split(' - ');
    return parts[0]?.trim() || '';
  };

  // Get days difference between two dates
  const getDaysDifference = (date1: string, date2: string): number => {
    const d1 = parseGermanDate(date1);
    const d2 = parseGermanDate(date2);
    return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  };

  useEffect(() => {
    if (!isOpen) return;

    // Get the latest date from current trips
    const currentDates = currentTrips.map(t => parseGermanDate(t.datum));
    const latestDate = new Date(Math.max(...currentDates.map(d => d.getTime())));
    const latestDateStr = formatDate(latestDate);

    // Get destination from current trip
    const currentDestination = extractDestination(currentTrips[0].reise);

    // Find potential connecting trips
    const potential = allTrips.filter(trip => {
      // Must be return trip
      if (trip.direction !== 'rueck') return false;

      // Must be unplanned or draft
      if (trip.planningStatus !== 'unplanned' && trip.planningStatus !== 'draft') return false;

      // Must be 1-3 days after current trip
      const daysDiff = getDaysDifference(latestDateStr, trip.datum);
      if (daysDiff < 1 || daysDiff > 3) return false;

      // Must be from DIFFERENT location
      const tripOrigin = extractOrigin(trip.reise);
      return tripOrigin !== currentDestination;
    });

    setPotentialTrips(potential);
  }, [isOpen, currentTrips, allTrips]);

  // Group potential trips by their group_id and date
  const groupedTrips = potentialTrips.reduce((acc, trip) => {
    const key = trip.groupId || trip.id;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(trip);
    return acc;
  }, {} as Record<string, Trip[]>);

  const handleSave = () => {
    if (selectedGroupId) {
      onSave(selectedGroupId);
      onClose();
    }
  };

  const currentDate = currentTrips[0]?.datum || '';
  const currentDestination = extractDestination(currentTrips[0]?.reise || '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>🔗 Anschlussfahrt verbinden</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-semibold">Aktuelle Fahrt:</p>
            <p className="text-sm">
              Bus {currentGroup.trip_number}: {currentDestination} am {currentDate}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">
              Verfügbare Rückfahrten von anderen Orten (1-3 Tage später):
            </p>

            {Object.keys(groupedTrips).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine passenden Anschlussfahrten gefunden.
              </p>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {Object.entries(groupedTrips).map(([groupKey, trips]) => {
                    const firstTrip = trips[0];
                    const origin = extractOrigin(firstTrip.reise);
                    const totalPax = trips.reduce((sum, t) => sum + t.buchungen, 0);
                    const daysDiff = getDaysDifference(currentDate, firstTrip.datum);
                    
                    return (
                      <div
                        key={groupKey}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          selectedGroupId === groupKey
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedGroupId(groupKey)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">+{daysDiff} Tag{daysDiff > 1 ? 'e' : ''}</Badge>
                              <span className="font-medium">{origin}</span>
                              <span className="text-sm text-muted-foreground">am {firstTrip.datum}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {trips.length} Fahrt{trips.length > 1 ? 'en' : ''} • {totalPax} PAX
                            </p>
                          </div>
                          {selectedGroupId === groupKey && (
                            <Badge className="bg-primary">Ausgewählt</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!selectedGroupId}>
            Verbinden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
