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
import { Trip, BusDetails, Bus, Stop } from '@/types/bus';
import { fetchBuses } from '@/lib/supabaseOperations';
import { toast } from 'sonner';

interface GroupFormProps {
  groupId: string;
  trips: Trip[];
  stops: Stop[];
  onUpdateGroup: (groupId: string, updates: Partial<Trip>) => void;
  onCompleteGroup: (groupId: string) => void;
  onSetGroupToDraft: (groupId: string) => void;
  onDissolveGroup: (groupId: string) => void;
}

export const GroupForm = ({
  groupId,
  trips,
  stops,
  onUpdateGroup,
  onCompleteGroup,
  onSetGroupToDraft,
  onDissolveGroup,
}: GroupFormProps) => {
  const firstTrip = trips[0];
  const isLocked = firstTrip.planningStatus === 'locked';
  const totalPassengers = trips.reduce((sum, t) => sum + t.buchungen, 0);

  const [buses, setBuses] = useState<Bus[]>([]);
  const [busDetails, setBusDetails] = useState<BusDetails>({
    busId: firstTrip.busDetails?.busId || '',
    kmHinweg: firstTrip.busDetails?.kmHinweg || '',
    kmRueckweg: firstTrip.busDetails?.kmRueckweg || '',
    luggage: firstTrip.busDetails?.luggage || '',
    accommodation: firstTrip.busDetails?.accommodation || '',
    notes: firstTrip.busDetails?.notes || '',
  });

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
    onUpdateGroup(groupId, { busDetails });
    onCompleteGroup(groupId);
  };

  const handleDissolve = () => {
    if (confirm('Möchten Sie diese Busplanung auflösen?')) {
      onDissolveGroup(groupId);
    }
  };

  // Aggregate stops for this group
  const groupStops = stops.filter(stop => 
    trips.some(trip => trip.reisecode === stop.Reisecode)
  );

  // Group stops by location and time, sum passengers
  const aggregatedStops = groupStops.reduce((acc, stop) => {
    const location = stop['Zustieg/Ausstieg'] || 'Unbekannt';
    const key = `${stop.Zeit || ''}-${location}`;
    if (!acc[key]) {
      acc[key] = {
        time: stop.Zeit || '',
        location: location,
        passengers: stop.Anzahl || 0,
      };
    } else {
      acc[key].passengers += stop.Anzahl || 0;
    }
    return acc;
  }, {} as Record<string, { time: string; location: string; passengers: number }>);

  // Sort by time
  const sortedStops = Object.values(aggregatedStops).sort((a, b) => 
    (a.time || '').localeCompare(b.time || '')
  );

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-lg p-4 border">
        <h4 className="font-semibold mb-3">Enthaltene Reisen:</h4>
        {trips.map(trip => (
          <div key={trip.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
            <span>{trip.direction === 'hin' ? '🟢' : '🔴'}</span>
            <span>{trip.datum} {trip.uhrzeit || '--:--'}</span>
            <span className="font-semibold">{trip.reisecode}</span>
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
                <span className="font-mono text-muted-foreground">{stop.time}</span>
                <span className="flex-1">{stop.location}</span>
                <span className="font-semibold">{stop.passengers} PAX</span>
              </div>
            ))}
          </div>
        </div>
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
              {buses.map(bus => (
                <SelectItem key={bus.id} value={bus.id}>
                  {bus.contractual ? '★ ' : ''}{bus.name} ({bus.seats} Plätze)
                </SelectItem>
              ))}
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
    </div>
  );
};
