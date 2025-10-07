import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Trip, BusDetails, Bus, Stop } from '@/types/bus';
import { fetchBuses } from '@/lib/supabaseOperations';
import { toast } from 'sonner';
import { parseGermanDate, addDays } from '@/lib/dateUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SplitDialog, SplitGroup } from './SplitDialog';

interface GroupFormProps {
  groupId: string;
  trips: Trip[];
  stops: Stop[];
  onUpdateGroup: (groupId: string, updates: Partial<Trip>) => void;
  onCompleteGroup: (groupId: string) => void;
  onSetGroupToDraft: (groupId: string) => void;
  onDissolveGroup: (groupId: string) => void;
  onSplitGroup: (groupId: string, splitGroups: any[]) => void;
}

export const GroupForm = ({
  groupId,
  trips,
  stops,
  onUpdateGroup,
  onCompleteGroup,
  onSetGroupToDraft,
  onDissolveGroup,
  onSplitGroup,
}: GroupFormProps) => {
  const firstTrip = trips[0];
  const isLocked = firstTrip.planningStatus === 'locked';
  const totalPassengers = trips.reduce((sum, t) => sum + t.buchungen, 0);

  // Check for Standbus (bus stays on-site)
  const hinTrips = trips.filter(t => t.direction === 'hin');
  const rueckTrips = trips.filter(t => t.direction === 'rueck');
  
  let isStandbus = false;
  let standbusDays = 0;
  
  if (hinTrips.length > 0 && rueckTrips.length > 0) {
    const hinDate = parseGermanDate(hinTrips[0].datum);
    const rueckDate = parseGermanDate(rueckTrips[0].datum);
    standbusDays = Math.floor((rueckDate.getTime() - hinDate.getTime()) / (1000 * 60 * 60 * 24));
    isStandbus = standbusDays > 2;
  }

  const [buses, setBuses] = useState<Bus[]>([]);
  const [busDetails, setBusDetails] = useState<BusDetails>({
    busId: firstTrip.busDetails?.busId || '',
    kmHinweg: firstTrip.busDetails?.kmHinweg || '',
    kmRueckweg: firstTrip.busDetails?.kmRueckweg || '',
    luggage: firstTrip.busDetails?.luggage || '',
    accommodation: firstTrip.busDetails?.accommodation || '',
    notes: firstTrip.busDetails?.notes || '',
  });
  const [showSplitDialog, setShowSplitDialog] = useState(false);

  const maxBusCapacity = Math.max(...buses.map(b => b.seats), 61);
  const needsSplit = totalPassengers > maxBusCapacity;

  useEffect(() => {
    fetchBuses().then(setBuses).catch(console.error);
  }, []);

  useEffect(() => {
    if (firstTrip.busDetails) {
      setBusDetails(firstTrip.busDetails);
    }
  }, [firstTrip.busDetails]);

  const handleSave = () => {
    onUpdateGroup(groupId, { busDetails });
    toast.success('Busplanung gespeichert');
  };

  const handleComplete = () => {
    if (!busDetails.busId) {
      toast.error('Bitte wählen Sie einen Bus aus');
      return;
    }
    
    // Check if group is oversized
    if (needsSplit) {
      setShowSplitDialog(true);
      return;
    }
    
    onUpdateGroup(groupId, { busDetails });
    onCompleteGroup(groupId);
  };

  const handleSplit = async (splitMethod: string, splitGroups: SplitGroup[]) => {
    console.log('[GroupForm] Split requested:', splitMethod, splitGroups);
    setShowSplitDialog(false);
    
    // Call the parent's split handler which will create actual bus groups
    onSplitGroup(groupId, splitGroups);
  };

  const handleDissolve = () => {
    if (confirm('Möchten Sie diese Busplanung auflösen?')) {
      onDissolveGroup(groupId);
    }
  };

  // Aggregate stops for this group - only include stops with valid time data
  const groupStops = stops.filter(stop => 
    trips.some(trip => trip.reisecode === stop.Reisecode) &&
    stop.Zeit && stop.Zeit.trim() !== '' // Only include stops with time
  );

  // Get base trip date from first trip
  const baseTripDate = trips[0].datum; // "DD.MM.YYYY" format

  // Group stops by location and time, sum passengers, calculate dates
  const aggregatedStops = groupStops.reduce((acc, stop) => {
    const location = stop['Zustieg/Ausstieg'] || 'Unbekannt';
    const stopTime = stop.Zeit!; // We know it exists from filter above
    
    // Calculate actual date for this stop (handle overnight trips)
    let stopDate = baseTripDate;
    const hour = parseInt(stopTime.split(':')[0]);
    // If time is before 06:00, assume it's the next day
    if (hour < 6) {
      stopDate = addDays(baseTripDate, 1);
    }
    
    const key = `${stopDate}-${stopTime}-${location}`;
    if (!acc[key]) {
      acc[key] = {
        date: stopDate,
        time: stopTime,
        datetime: parseGermanDate(stopDate).getTime() + parseInt(stopTime.split(':')[0]) * 3600000 + parseInt(stopTime.split(':')[1]) * 60000,
        location: location,
        passengers: stop.Anzahl || 0,
      };
    } else {
      acc[key].passengers += stop.Anzahl || 0;
    }
    return acc;
  }, {} as Record<string, { date: string; time: string; datetime: number; location: string; passengers: number }>);

  // Sort by actual datetime
  const sortedStops = Object.values(aggregatedStops).sort((a, b) => a.datetime - b.datetime);

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-lg p-4 border">
        <div className="flex items-center gap-3 mb-3">
          <h4 className="font-semibold">Enthaltene Reisen:</h4>
          {isStandbus && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 text-white">
                    🚌 STANDBUS
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bus bleibt vor Ort ({standbusDays} Tage)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {trips.map(trip => (
          <div key={trip.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
            <span>{trip.direction === 'hin' ? '🟢' : '🔴'}</span>
            <span>{trip.datum} {trip.uhrzeit || '--:--'}</span>
            <span className="font-semibold">{trip.reisecode}</span>
            {trip.produktcode && (
              <Badge variant="secondary" className="text-xs">
                {trip.produktcode}
              </Badge>
            )}
            <span className="flex-1">{trip.reise}</span>
            <span className="font-semibold">{trip.buchungen} PAX</span>
          </div>
        ))}
      </div>

      {sortedStops.length > 0 && (
        <div className="bg-card rounded-lg p-4 border">
          <h4 className="font-semibold mb-3">📍 Haltestellen:</h4>
          <div className="space-y-2">
            {sortedStops.map((stop, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-muted-foreground">{stop.date} {stop.time}</span>
                <span className="flex-1">{stop.location}</span>
                <span className="font-semibold">{stop.passengers} PAX</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {needsSplit && (
        <Alert className="bg-warning/10 border-warning">
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>⚠️ Bus-Aufteilung erforderlich:</strong> {totalPassengers} Passagiere überschreiten die maximale Kapazität
            </div>
            <Button size="sm" onClick={() => setShowSplitDialog(true)} className="gradient-primary">
              Aufteilen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`busId-${groupId}`}>Bus auswählen</Label>
          <Select
            value={busDetails.busId}
            onValueChange={(value) => setBusDetails({ ...busDetails, busId: value })}
            disabled={isLocked}
          >
            <SelectTrigger id={`busId-${groupId}`}>
              <SelectValue placeholder="-- Bitte wählen --" />
            </SelectTrigger>
            <SelectContent>
              {buses.map(bus => {
                const tooSmall = totalPassengers > bus.seats;
                return (
                  <SelectItem 
                    key={bus.id} 
                    value={bus.id}
                    disabled={tooSmall}
                  >
                    {bus.contractual ? '★ ' : ''}{bus.name} ({bus.seats} Plätze)
                    {tooSmall && ' - Zu klein'}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`kmHinweg-${groupId}`}>KM Hinweg</Label>
          <Input
            id={`kmHinweg-${groupId}`}
            type="number"
            value={busDetails.kmHinweg}
            onChange={(e) => setBusDetails({ ...busDetails, kmHinweg: e.target.value })}
            disabled={isLocked}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`kmRueckweg-${groupId}`}>KM Rückweg</Label>
          <Input
            id={`kmRueckweg-${groupId}`}
            type="number"
            value={busDetails.kmRueckweg}
            onChange={(e) => setBusDetails({ ...busDetails, kmRueckweg: e.target.value })}
            disabled={isLocked}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`luggage-${groupId}`}>Gepäck</Label>
          <Select
            value={busDetails.luggage}
            onValueChange={(value) => setBusDetails({ ...busDetails, luggage: value })}
            disabled={isLocked}
          >
            <SelectTrigger id={`luggage-${groupId}`}>
              <SelectValue placeholder="-- Bitte wählen --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Koffer">Koffer</SelectItem>
              <SelectItem value="Hänger">Hänger</SelectItem>
              <SelectItem value="Koffer + Hänger">Koffer + Hänger</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`accommodation-${groupId}`}>Fahrerzimmer</Label>
          <Select
            value={busDetails.accommodation}
            onValueChange={(value) => setBusDetails({ ...busDetails, accommodation: value })}
            disabled={isLocked}
          >
            <SelectTrigger id={`accommodation-${groupId}`}>
              <SelectValue placeholder="-- Bitte wählen --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tageszimmer">Tageszimmer</SelectItem>
              <SelectItem value="Ohne Zimmer">Ohne Zimmer</SelectItem>
              <SelectItem value="Hotel">Hotel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2 lg:col-span-3">
          <Label htmlFor={`notes-${groupId}`}>Anmerkungen</Label>
          <Textarea
            id={`notes-${groupId}`}
            rows={3}
            value={busDetails.notes}
            onChange={(e) => setBusDetails({ ...busDetails, notes: e.target.value })}
            disabled={isLocked}
          />
        </div>
      </div>

      {!isLocked ? (
        <div className="flex gap-3 flex-wrap">
          <Button onClick={handleSave} className="bg-success text-success-foreground hover:bg-success/90">
            💾 Speichern
          </Button>
          {firstTrip.planningStatus === 'completed' ? (
            <Button onClick={() => onSetGroupToDraft(groupId)} className="bg-warning text-warning-foreground hover:bg-warning/90">
              ↩️ Zurück auf Entwurf
            </Button>
          ) : (
            <Button onClick={handleComplete} className="gradient-primary">
              ✅ Fertigstellen
            </Button>
          )}
          <Button onClick={handleDissolve} variant="destructive">
            ❌ Auflösen
          </Button>
        </div>
      ) : (
        <Alert>
          <AlertDescription>🔒 Diese Busplanung ist gesperrt.</AlertDescription>
        </Alert>
      )}

      <SplitDialog
        open={showSplitDialog}
        onOpenChange={setShowSplitDialog}
        trips={trips}
        stops={stops}
        buses={buses}
        onSplit={handleSplit}
      />
    </div>
  );
};
