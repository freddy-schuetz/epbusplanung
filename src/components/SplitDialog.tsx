import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Trip, Stop, Bus } from '@/types/bus';
import { Badge } from '@/components/ui/badge';

interface SplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trips: Trip[];
  stops: Stop[];
  buses: Bus[];
  onSplit: (splitMethod: 'stops' | 'trips' | 'manual', splitGroups: SplitGroup[]) => void;
}

export interface SplitGroup {
  trips: Trip[];
  suggestedBusId?: string;
  passengers: number;
}

export const SplitDialog = ({
  open,
  onOpenChange,
  trips,
  stops,
  buses,
  onSplit,
}: SplitDialogProps) => {
  const [splitMethod, setSplitMethod] = useState<'stops' | 'trips' | 'manual'>('stops');
  
  const totalPax = trips.reduce((sum, t) => sum + t.buchungen, 0);
  const sortedBuses = [...buses].sort((a, b) => b.seats - a.seats);
  
  // Calculate suggested split
  const calculateSplit = (): SplitGroup[] => {
    if (splitMethod === 'stops') {
      return splitByStops(trips, stops, sortedBuses);
    } else if (splitMethod === 'trips') {
      return splitByTrips(trips, sortedBuses);
    }
    return [];
  };

  const splitGroups = calculateSplit();

  const handleSplit = () => {
    onSplit(splitMethod, splitGroups);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">⚠️ Bus-Aufteilung erforderlich</DialogTitle>
          <DialogDescription>
            {totalPax} Passagiere überschreiten die maximale Kapazität von {sortedBuses[0]?.seats || 61} Plätzen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {splitGroups.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold">Vorgeschlagene Aufteilung:</h4>
              {splitGroups.map((group, index) => {
                const bus = buses.find(b => b.id === group.suggestedBusId);
                return (
                  <div key={index} className="flex items-center justify-between bg-card p-3 rounded border">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🚌</span>
                      <div>
                        <div className="font-semibold">Bus {index + 1}</div>
                        <div className="text-sm text-muted-foreground">
                          {bus ? `${bus.name} (${bus.seats} Plätze)` : 'Bus wählen'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{group.passengers} PAX</div>
                      <div className="text-sm text-muted-foreground">{group.trips.length} Reisen</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            <Label className="font-semibold">Aufteilungsmethode:</Label>
            <RadioGroup value={splitMethod} onValueChange={(value) => setSplitMethod(value as any)}>
              <div className="flex items-start space-x-3 bg-card p-3 rounded border hover:bg-accent cursor-pointer">
                <RadioGroupItem value="stops" id="stops" />
                <Label htmlFor="stops" className="cursor-pointer flex-1">
                  <div className="font-semibold">Nach Haltestellen optimiert</div>
                  <div className="text-sm text-muted-foreground">
                    Gruppiert Passagiere nach Einstiegsorten für optimale Auslastung
                  </div>
                </Label>
              </div>

              <div className="flex items-start space-x-3 bg-card p-3 rounded border hover:bg-accent cursor-pointer">
                <RadioGroupItem value="trips" id="trips" />
                <Label htmlFor="trips" className="cursor-pointer flex-1">
                  <div className="font-semibold">Nach Reisecodes getrennt</div>
                  <div className="text-sm text-muted-foreground">
                    Teilt Reisen gleichmäßig auf verschiedene Busse auf
                  </div>
                </Label>
              </div>

              <div className="flex items-start space-x-3 bg-card p-3 rounded border hover:bg-accent cursor-pointer opacity-50">
                <RadioGroupItem value="manual" id="manual" disabled />
                <Label htmlFor="manual" className="cursor-pointer flex-1">
                  <div className="font-semibold">Manuell zuweisen</div>
                  <div className="text-sm text-muted-foreground">
                    Wählen Sie selbst, welche Reisen in welchen Bus kommen (Bald verfügbar)
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {splitGroups.some(g => g.passengers < 10) && (
            <div className="bg-warning/10 border border-warning/30 rounded p-3 text-sm">
              <strong>⚠️ Hinweis:</strong> Eine Gruppe hat weniger als 10 Passagiere. 
              Prüfen Sie, ob die Aufteilung wirtschaftlich ist.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSplit} className="gradient-primary">
            Aufteilen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Split by stops - group passengers by stop location
const splitByStops = (trips: Trip[], stops: Stop[], buses: Bus[]): SplitGroup[] => {
  // Group stops by location and count passengers
  const stopGroups = new Map<string, { trips: Trip[]; passengers: number }>();
  
  trips.forEach(trip => {
    const tripStops = stops.filter(s => s.Reisecode === trip.reisecode);
    const firstStop = tripStops[0]?.['Zustieg/Ausstieg'] || 'Unbekannt';
    
    if (!stopGroups.has(firstStop)) {
      stopGroups.set(firstStop, { trips: [], passengers: 0 });
    }
    
    const group = stopGroups.get(firstStop)!;
    group.trips.push(trip);
    group.passengers += trip.buchungen;
  });

  // Distribute into buses
  const splitGroups: SplitGroup[] = [];
  const sortedStopGroups = Array.from(stopGroups.values()).sort((a, b) => b.passengers - a.passengers);
  
  sortedStopGroups.forEach(stopGroup => {
    // Try to add to existing bus
    let added = false;
    for (const group of splitGroups) {
      const bus = buses.find(b => b.id === group.suggestedBusId);
      if (bus && group.passengers + stopGroup.passengers <= bus.seats) {
        group.trips.push(...stopGroup.trips);
        group.passengers += stopGroup.passengers;
        added = true;
        break;
      }
    }
    
    // Create new bus if needed
    if (!added) {
      const availableBus = buses.find(b => b.seats >= stopGroup.passengers);
      splitGroups.push({
        trips: stopGroup.trips,
        passengers: stopGroup.passengers,
        suggestedBusId: availableBus?.id,
      });
    }
  });

  return splitGroups;
};

// Split by trips - distribute trips evenly
const splitByTrips = (trips: Trip[], buses: Bus[]): SplitGroup[] => {
  const sortedTrips = [...trips].sort((a, b) => b.buchungen - a.buchungen);
  const splitGroups: SplitGroup[] = [];
  
  sortedTrips.forEach(trip => {
    // Try to add to existing bus with capacity
    let added = false;
    for (const group of splitGroups) {
      const bus = buses.find(b => b.id === group.suggestedBusId);
      if (bus && group.passengers + trip.buchungen <= bus.seats) {
        group.trips.push(trip);
        group.passengers += trip.buchungen;
        added = true;
        break;
      }
    }
    
    // Create new bus if needed
    if (!added) {
      const availableBus = buses.find(b => b.seats >= trip.buchungen);
      splitGroups.push({
        trips: [trip],
        passengers: trip.buchungen,
        suggestedBusId: availableBus?.id,
      });
    }
  });

  return splitGroups;
};
