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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trip, Stop, Bus } from '@/types/bus';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

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
  
  // Bus selection state with suggested buses as defaults
  const [bus1Id, setBus1Id] = useState<string>(splitGroups[0]?.suggestedBusId || '');
  const [bus2Id, setBus2Id] = useState<string>(splitGroups[1]?.suggestedBusId || '');
  
  // Update selected buses when split method changes
  useState(() => {
    if (splitGroups[0]?.suggestedBusId) setBus1Id(splitGroups[0].suggestedBusId);
    if (splitGroups[1]?.suggestedBusId) setBus2Id(splitGroups[1].suggestedBusId);
  });
  
  // Validate capacity
  const bus1 = buses.find(b => b.id === bus1Id);
  const bus2 = buses.find(b => b.id === bus2Id);
  const group1Pax = splitGroups[0]?.passengers || 0;
  const group2Pax = splitGroups[1]?.passengers || 0;
  
  const bus1HasCapacity = bus1 && bus1.seats >= group1Pax;
  const bus2HasCapacity = bus2 && bus2.seats >= group2Pax;
  const canSplit = bus1Id && bus2Id && bus1HasCapacity && bus2HasCapacity;

  const handleSplit = () => {
    // Update split groups with selected buses
    const updatedGroups = [
      { ...splitGroups[0], suggestedBusId: bus1Id },
      { ...splitGroups[1], suggestedBusId: bus2Id },
    ];
    onSplit(splitMethod, updatedGroups);
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
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h4 className="font-semibold">Bus-Auswahl:</h4>
              
              {/* Bus 1 Selection */}
              <div className="bg-card p-3 rounded border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚌</span>
                    <div>
                      <div className="font-semibold">Bus 1</div>
                      <div className="text-sm text-muted-foreground">
                        {group1Pax} PAX · {splitGroups[0]?.trips.length} Reisen
                      </div>
                    </div>
                  </div>
                </div>
                
                <Select value={bus1Id} onValueChange={setBus1Id}>
                  <SelectTrigger className={!bus1HasCapacity && bus1Id ? 'border-destructive' : ''}>
                    <SelectValue placeholder="-- Bus wählen --" />
                  </SelectTrigger>
                  <SelectContent>
                    {buses.map(bus => {
                      const hasCapacity = bus.seats >= group1Pax;
                      return (
                        <SelectItem key={bus.id} value={bus.id}>
                          {bus.name} ({bus.seats} Plätze) {!hasCapacity && '⚠️ Zu klein'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                {bus1Id && !bus1HasCapacity && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Dieser Bus hat nur {bus1?.seats} Plätze, benötigt werden {group1Pax}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              {/* Bus 2 Selection */}
              <div className="bg-card p-3 rounded border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚌</span>
                    <div>
                      <div className="font-semibold">Bus 2</div>
                      <div className="text-sm text-muted-foreground">
                        {group2Pax} PAX · {splitGroups[1]?.trips.length} Reisen
                      </div>
                    </div>
                  </div>
                </div>
                
                <Select value={bus2Id} onValueChange={setBus2Id}>
                  <SelectTrigger className={!bus2HasCapacity && bus2Id ? 'border-destructive' : ''}>
                    <SelectValue placeholder="-- Bus wählen --" />
                  </SelectTrigger>
                  <SelectContent>
                    {buses.map(bus => {
                      const hasCapacity = bus.seats >= group2Pax;
                      return (
                        <SelectItem key={bus.id} value={bus.id}>
                          {bus.name} ({bus.seats} Plätze) {!hasCapacity && '⚠️ Zu klein'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                {bus2Id && !bus2HasCapacity && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Dieser Bus hat nur {bus2?.seats} Plätze, benötigt werden {group2Pax}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
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
          <Button onClick={handleSplit} disabled={!canSplit} className="gradient-primary">
            Aufteilen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Split by stops - balance trips evenly, prioritizing similar departure locations
const splitByStops = (trips: Trip[], stops: Stop[], buses: Bus[]): SplitGroup[] => {
  console.log('[SplitDialog] splitByStops - Input trips:', trips.length, 'Total PAX:', trips.reduce((sum, t) => sum + t.buchungen, 0));
  
  // Sort trips by passenger count (largest first) for better balancing
  const sortedTrips = [...trips].sort((a, b) => b.buchungen - a.buchungen);
  
  // Create two groups
  const group1: SplitGroup = { trips: [], passengers: 0, suggestedBusId: buses[0]?.id };
  const group2: SplitGroup = { trips: [], passengers: 0, suggestedBusId: buses[1]?.id };
  
  // Distribute trips using greedy algorithm - always add to the group with fewer passengers
  sortedTrips.forEach(trip => {
    if (group1.passengers <= group2.passengers) {
      group1.trips.push(trip);
      group1.passengers += trip.buchungen;
    } else {
      group2.trips.push(trip);
      group2.passengers += trip.buchungen;
    }
  });
  
  console.log('[SplitDialog] splitByStops - Group 1:', group1.trips.length, 'trips,', group1.passengers, 'PAX');
  console.log('[SplitDialog] splitByStops - Group 2:', group2.trips.length, 'trips,', group2.passengers, 'PAX');
  
  // Safety check: if one group is empty, force a split
  if (group2.trips.length === 0 && group1.trips.length > 0) {
    console.log('[SplitDialog] WARNING: Group 2 is empty, forcing split');
    // Move half the trips to group 2
    const half = Math.ceil(group1.trips.length / 2);
    group2.trips = group1.trips.splice(half);
    group2.passengers = group2.trips.reduce((sum, t) => sum + t.buchungen, 0);
    group1.passengers = group1.trips.reduce((sum, t) => sum + t.buchungen, 0);
    console.log('[SplitDialog] After forced split - Group 1:', group1.passengers, 'PAX, Group 2:', group2.passengers, 'PAX');
  }

  return [group1, group2];
};

// Split by trips - balance trips across two groups
const splitByTrips = (trips: Trip[], buses: Bus[]): SplitGroup[] => {
  // Sort trips by passenger count (largest first) for better balancing
  const sortedTrips = [...trips].sort((a, b) => b.buchungen - a.buchungen);
  
  // Create two groups with suggested buses
  const group1: SplitGroup = { trips: [], passengers: 0, suggestedBusId: buses[0]?.id };
  const group2: SplitGroup = { trips: [], passengers: 0, suggestedBusId: buses[1]?.id };
  
  // Distribute trips to balance passenger counts (greedy balancing)
  sortedTrips.forEach(trip => {
    // Always add to the group with fewer passengers
    if (group1.passengers <= group2.passengers) {
      group1.trips.push(trip);
      group1.passengers += trip.buchungen;
    } else {
      group2.trips.push(trip);
      group2.passengers += trip.buchungen;
    }
  });

  return [group1, group2];
};
