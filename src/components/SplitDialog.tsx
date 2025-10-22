import { useState, useEffect } from 'react';
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
import { AlertCircle, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  assignedStopKeys?: string[]; // Keys of stops assigned to this group
}

export const SplitDialog = ({
  open,
  onOpenChange,
  trips,
  stops,
  buses,
  onSplit,
}: SplitDialogProps) => {
  const totalPax = trips.reduce((sum, t) => sum + t.buchungen, 0);
  const sortedBuses = [...buses].sort((a, b) => b.seats - a.seats);
  
  // Map stops to include passenger counts and trip info
  const enhancedStops = stops.map(stop => ({
    ...stop,
    passengers: stop.Anzahl || 0,
    stopName: stop['Zustieg/Ausstieg'] || 'Unbekannt',
    time: stop.Zeit,
  })).filter(stop => stop.passengers > 0);
  
  // Stop assignment state: stopId -> 'bus1' | 'bus2' | null
  const [stopAssignments, setStopAssignments] = useState<Record<string, 'bus1' | 'bus2' | null>>({});
  
  // Bus selection state
  const [bus1Id, setBus1Id] = useState<string>(sortedBuses[0]?.id || '');
  const [bus2Id, setBus2Id] = useState<string>(sortedBuses[1]?.id || '');
  
  // Calculate live capacity
  const calculateCapacity = () => {
    let bus1Pax = 0;
    let bus2Pax = 0;
    
    enhancedStops.forEach(stop => {
      const stopKey = `${stop.Reisecode}-${stop.time}-${stop.stopName}`;
      const assignment = stopAssignments[stopKey];
      
      if (assignment === 'bus1') {
        bus1Pax += stop.passengers;
      } else if (assignment === 'bus2') {
        bus2Pax += stop.passengers;
      }
    });
    
    // Debug logging
    console.log('[SplitDialog] Capacity calculation:');
    console.log('  - Total stops:', enhancedStops.length);
    console.log('  - Bus 1 PAX:', bus1Pax);
    console.log('  - Bus 2 PAX:', bus2Pax);
    console.log('  - Total assigned:', bus1Pax + bus2Pax);
    console.log('  - Total from trips:', totalPax);
    console.log('  - Stops passengers sum:', enhancedStops.reduce((sum, s) => sum + s.passengers, 0));
    
    return { bus1Pax, bus2Pax };
  };
  
  const { bus1Pax, bus2Pax } = calculateCapacity();
  
  // Calculate unassigned based on stops total, not trips total
  const totalStopsPax = enhancedStops.reduce((sum, s) => sum + s.passengers, 0);
  const unassignedPax = totalStopsPax - bus1Pax - bus2Pax;
  
  // Validate capacity
  const bus1 = buses.find(b => b.id === bus1Id);
  const bus2 = buses.find(b => b.id === bus2Id);
  
  const bus1HasCapacity = !bus1 || bus1Pax <= bus1.seats;
  const bus2HasCapacity = !bus2 || bus2Pax <= bus2.seats;
  const allStopsAssigned = unassignedPax === 0;
  const canSplit = bus1Id && bus2Id && bus1HasCapacity && bus2HasCapacity && allStopsAssigned;

  // Auto-optimize: distribute stops to balance load
  const handleAutoOptimize = () => {
    const targetPax = Math.ceil(totalPax / 2);
    const newAssignments: Record<string, 'bus1' | 'bus2'> = {};
    
    // Sort stops chronologically, considering overnight trips
    const sortedStops = [...enhancedStops].sort((a, b) => {
      // Handle "Zeit folgt" or empty time entries
      if (!a.time || a.time === 'Zeit folgt') return 1;
      if (!b.time || b.time === 'Zeit folgt') return -1;
      
      const [hoursA] = a.time.split(':').map(Number);
      const [hoursB] = b.time.split(':').map(Number);
      
      // Early morning times (00:00-05:59) are next day
      const dayA = hoursA < 6 ? 1 : 0;
      const dayB = hoursB < 6 ? 1 : 0;
      
      // First sort by day, then by time
      if (dayA !== dayB) return dayA - dayB;
      return a.time.localeCompare(b.time);
    });
    
    let bus1Current = 0;
    let bus2Current = 0;
    
    // Greedy assignment: assign to bus with more remaining capacity
    sortedStops.forEach(stop => {
      const stopKey = `${stop.Reisecode}-${stop.time}-${stop.stopName}`;
      
      if (bus1Current <= bus2Current) {
        newAssignments[stopKey] = 'bus1';
        bus1Current += stop.passengers;
      } else {
        newAssignments[stopKey] = 'bus2';
        bus2Current += stop.passengers;
      }
    });
    
    setStopAssignments(newAssignments);
  };
  
  // Auto-optimize on dialog open
  useEffect(() => {
    if (open && Object.keys(stopAssignments).length === 0) {
      handleAutoOptimize();
    }
  }, [open]);
  
  const assignStopToBus = (stopKey: string, bus: 'bus1' | 'bus2') => {
    setStopAssignments(prev => ({
      ...prev,
      [stopKey]: bus,
    }));
  };

  const handleSplit = () => {
    // Calculate passenger counts per trip per bus based on stop assignments
    const tripBusData = new Map<string, { bus1Pax: number; bus2Pax: number }>();
    
    // Track which stop keys are assigned to each bus
    const bus1StopKeys: string[] = [];
    const bus2StopKeys: string[] = [];
    
    enhancedStops.forEach(stop => {
      const stopKey = `${stop.Reisecode}-${stop.time}-${stop.stopName}`;
      const assignment = stopAssignments[stopKey];
      
      if (!tripBusData.has(stop.Reisecode)) {
        tripBusData.set(stop.Reisecode, { bus1Pax: 0, bus2Pax: 0 });
      }
      
      const data = tripBusData.get(stop.Reisecode)!;
      if (assignment === 'bus1') {
        data.bus1Pax += stop.passengers;
        bus1StopKeys.push(stopKey);
      } else if (assignment === 'bus2') {
        data.bus2Pax += stop.passengers;
        bus2StopKeys.push(stopKey);
      }
    });
    
    // Create modified trips for each bus with adjusted passenger counts
    const bus1ModifiedTrips: Trip[] = [];
    const bus2ModifiedTrips: Trip[] = [];
    let totalBus1Pax = 0;
    let totalBus2Pax = 0;
    
    trips.forEach(trip => {
      const data = tripBusData.get(trip.reisecode);
      if (!data) return;
      
      // Create trip for bus 1 if it has passengers from this trip's stops
      if (data.bus1Pax > 0) {
        bus1ModifiedTrips.push({
          ...trip,
          buchungen: data.bus1Pax
        });
        totalBus1Pax += data.bus1Pax;
      }
      
      // Create trip for bus 2 if it has passengers from this trip's stops
      if (data.bus2Pax > 0) {
        bus2ModifiedTrips.push({
          ...trip,
          buchungen: data.bus2Pax
        });
        totalBus2Pax += data.bus2Pax;
      }
    });
    
    console.log('[SplitDialog] Split by stops result:', {
      bus1: { trips: bus1ModifiedTrips.length, pax: totalBus1Pax, stops: bus1StopKeys.length },
      bus2: { trips: bus2ModifiedTrips.length, pax: totalBus2Pax, stops: bus2StopKeys.length },
      tripBusData: Array.from(tripBusData.entries())
    });
    
    const group1: SplitGroup = {
      trips: bus1ModifiedTrips,
      passengers: totalBus1Pax,
      suggestedBusId: bus1Id,
      assignedStopKeys: bus1StopKeys,
    };
    
    const group2: SplitGroup = {
      trips: bus2ModifiedTrips,
      passengers: totalBus2Pax,
      suggestedBusId: bus2Id,
      assignedStopKeys: bus2StopKeys,
    };
    
    onSplit('manual', [group1, group2]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">⚠️ Bus-Aufteilung erforderlich</DialogTitle>
          <DialogDescription>
            {totalPax} Passagiere überschreiten die maximale Kapazität. Weisen Sie Haltestellen manuell zu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bus Selection and Capacity */}
          <div className="grid grid-cols-2 gap-4">
            {/* Bus 1 */}
            <div className={`bg-card p-4 rounded-lg border-2 ${!bus1HasCapacity ? 'border-destructive' : 'border-border'}`}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🚌</span>
                  <span className="font-semibold">Bus 1</span>
                </div>
                
                <Select value={bus1Id} onValueChange={setBus1Id}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Bus wählen --" />
                  </SelectTrigger>
                  <SelectContent>
                    {buses.map(bus => (
                      <SelectItem key={bus.id} value={bus.id}>
                        {bus.name} ({bus.seats} Plätze)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Kapazität:</span>
                    <span className={`font-semibold ${!bus1HasCapacity ? 'text-destructive' : ''}`}>
                      {bus1Pax}/{bus1?.seats || 0} PAX
                    </span>
                  </div>
                  {!bus1HasCapacity && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Überladen! Wählen Sie größeren Bus oder verteilen Sie Haltestellen neu.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </div>

            {/* Bus 2 */}
            <div className={`bg-card p-4 rounded-lg border-2 ${!bus2HasCapacity ? 'border-destructive' : 'border-border'}`}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🚌</span>
                  <span className="font-semibold">Bus 2</span>
                </div>
                
                <Select value={bus2Id} onValueChange={setBus2Id}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Bus wählen --" />
                  </SelectTrigger>
                  <SelectContent>
                    {buses.map(bus => (
                      <SelectItem key={bus.id} value={bus.id}>
                        {bus.name} ({bus.seats} Plätze)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Kapazität:</span>
                    <span className={`font-semibold ${!bus2HasCapacity ? 'text-destructive' : ''}`}>
                      {bus2Pax}/{bus2?.seats || 0} PAX
                    </span>
                  </div>
                  {!bus2HasCapacity && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Überladen! Wählen Sie größeren Bus oder verteilen Sie Haltestellen neu.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Auto-optimize button */}
          <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Automatische Optimierung</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleAutoOptimize}
            >
              Optimieren
            </Button>
          </div>

          {/* Unassigned warning */}
          {unassignedPax > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {unassignedPax} Passagiere noch nicht zugewiesen. Wählen Sie einen Bus für jede Haltestelle.
              </AlertDescription>
            </Alert>
          )}

          {/* Stops list */}
          <div className="space-y-2">
            <Label className="font-semibold">Haltestellen zuweisen:</Label>
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-4 space-y-2">
                {[...enhancedStops].sort((a, b) => {
                  // Sort chronologically, considering overnight trips
                  if (!a.time || a.time === 'Zeit folgt') return 1;
                  if (!b.time || b.time === 'Zeit folgt') return -1;
                  
                  const [hoursA] = a.time.split(':').map(Number);
                  const [hoursB] = b.time.split(':').map(Number);
                  
                  // Early morning times (00:00-05:59) are next day
                  const dayA = hoursA < 6 ? 1 : 0;
                  const dayB = hoursB < 6 ? 1 : 0;
                  
                  // First sort by day, then by time
                  if (dayA !== dayB) return dayA - dayB;
                  return a.time.localeCompare(b.time);
                }).map((stop) => {
                  const stopKey = `${stop.Reisecode}-${stop.time}-${stop.stopName}`;
                  const assignment = stopAssignments[stopKey];
                  
                  return (
                    <div 
                      key={stopKey}
                      className={`flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
                        assignment === 'bus1' ? 'border-l-4 border-l-primary' : 
                        assignment === 'bus2' ? 'border-l-4 border-l-secondary' : 
                        'border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{stop.stopName}</div>
                        <div className="text-sm text-muted-foreground">
                          {stop.time} · {stop.Reisecode}
                        </div>
                      </div>
                      
                      <Badge variant="secondary" className="mr-4">
                        {stop.passengers} PAX
                      </Badge>
                      
                      <div className="flex gap-2">
                        <Button
                          variant={assignment === 'bus1' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => assignStopToBus(stopKey, 'bus1')}
                        >
                          Bus 1
                        </Button>
                        <Button
                          variant={assignment === 'bus2' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => assignStopToBus(stopKey, 'bus2')}
                        >
                          Bus 2
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSplit} 
            disabled={!canSplit}
          >
            {!allStopsAssigned ? 'Alle Haltestellen zuweisen' : 'Aufteilen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
