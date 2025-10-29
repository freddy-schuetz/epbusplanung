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
  refreshKey?: number;
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
  refreshKey = 0,
  onUpdateGroup,
  onCompleteGroup,
  onSetGroupToDraft,
  onDissolveGroup,
  onSplitGroup,
}: GroupFormProps) => {
  console.log('[GroupForm] 🔄 Component rendered with refreshKey:', refreshKey);
  console.log('[GroupForm] 🔍 Received stops count:', stops.length);
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
  
  // Check each direction separately for split requirement
  const hinPax = hinTrips.reduce((sum, t) => sum + t.buchungen, 0);
  const rueckPax = rueckTrips.reduce((sum, t) => sum + t.buchungen, 0);
  
  const hinNeedsSplit = hinPax > maxBusCapacity;
  const rueckNeedsSplit = rueckPax > maxBusCapacity;
  const needsSplit = hinNeedsSplit || rueckNeedsSplit;

  useEffect(() => {
    fetchBuses().then(setBuses).catch(console.error);
  }, []);

  useEffect(() => {
    if (firstTrip.busDetails) {
      setBusDetails(firstTrip.busDetails);
    }
  }, [firstTrip.busDetails]);

  // Force re-processing when stops change or refreshKey changes
  useEffect(() => {
    console.log('[GroupForm] 🔄 Stops or refreshKey changed - forcing re-render');
    console.log('[GroupForm] 🔍 New stops count:', stops.length);
    console.log('[GroupForm] 🔍 New refreshKey:', refreshKey);
  }, [stops, refreshKey]);

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

  // Parse stop assignments from notes if this is a split group
  let assignedStopKeys: string[] | null = null;
  try {
    if (firstTrip.busDetails?.notes) {
      const notesData = JSON.parse(firstTrip.busDetails.notes);
      if (notesData.assignedStopKeys) {
        assignedStopKeys = notesData.assignedStopKeys;
        console.log('[GroupForm] Found assigned stop keys:', assignedStopKeys.length);
      }
    }
  } catch (e) {
    // Notes is not JSON or doesn't contain stop keys - use all stops
  }

  // DEBUG: Log trip data first
  console.log('[GroupForm] === PAX MISMATCH DEBUG ===');
  console.log('[GroupForm] Group ID:', groupId);
  console.log('[GroupForm] Trips in group:', trips.length);
  trips.forEach(trip => {
    console.log(`  - ${trip.reisecode} (${trip.direction}): ${trip.buchungen} PAX`);
  });
  console.log('[GroupForm] Total PAX from trips:', trips.reduce((sum, t) => sum + t.buchungen, 0));
  console.log('[GroupForm] All stops count:', stops.length);
  console.log('[GroupForm] 🔍 Sample stop structure:', stops.length > 0 ? stops[0] : 'No stops');
  
  // Aggregate stops for this group - match by reisecode AND direction
  let groupStops = stops.filter(stop => 
    trips.some(trip => {
      const reisecodeMatch = trip.reisecode === stop.Reisecode;
      const directionMatch = stop.Beförderung && (
        (trip.direction === 'hin' && stop.Beförderung.toLowerCase().includes('hinfahrt')) ||
        (trip.direction === 'rueck' && stop.Beförderung.toLowerCase().includes('rückfahrt'))
      );
      return reisecodeMatch && directionMatch;
    })
  );
  
  // Debug: Log filtered stops with their trip IDs
  console.log('[GroupForm] Filtered group stops:', groupStops.length);
  console.log('[GroupForm] 🔍 First 3 filtered stops:', groupStops.slice(0, 3).map(s => ({
    location: s['Zustieg/Ausstieg'],
    time: s.Zeit,
    pax: s.Anzahl,
    reisecode: s.Reisecode,
  })));
  const stopsByReisecode = groupStops.reduce((acc, stop) => {
    acc[stop.Reisecode] = (acc[stop.Reisecode] || 0) + (stop.Anzahl || 0);
    return acc;
  }, {} as Record<string, number>);
  console.log('[GroupForm] Stop PAX by reisecode:', stopsByReisecode);
  
  // Check for duplicate stops (same time + location)
  const stopKeys = groupStops.map(s => `${s.Zeit}-${s['Zustieg/Ausstieg']}-${s.Anzahl}`);
  const uniqueStopKeys = new Set(stopKeys);
  if (stopKeys.length !== uniqueStopKeys.size) {
    console.warn('[GroupForm] ⚠️ DUPLICATE STOPS DETECTED!');
    console.log('[GroupForm] Total stops:', stopKeys.length, 'Unique:', uniqueStopKeys.size);
  }
  
  // Debug: Log stops by direction
  const hinStops = groupStops.filter(s => s.Beförderung?.toLowerCase().includes('hinfahrt'));
  const rueckStops = groupStops.filter(s => s.Beförderung?.toLowerCase().includes('rückfahrt'));
  console.log('[GroupForm] Hin stops:', hinStops.length, 'PAX:', hinStops.reduce((sum, s) => sum + (s.Anzahl || 0), 0));
  console.log('[GroupForm] Rück stops:', rueckStops.length, 'PAX:', rueckStops.reduce((sum, s) => sum + (s.Anzahl || 0), 0));
  console.log('[GroupForm] Total stops PAX:', groupStops.reduce((sum, s) => sum + (s.Anzahl || 0), 0));
  console.log('[GroupForm] === END DEBUG ===');

  // If this is a split group with assigned stops, filter to only show those stops
  if (assignedStopKeys && assignedStopKeys.length > 0) {
    const assignedStopKeysSet = new Set(assignedStopKeys);
    groupStops = groupStops.filter(stop => {
      const stopKey = `${stop.Reisecode}-${stop.Zeit}-${stop['Zustieg/Ausstieg'] || 'Unbekannt'}`;
      return assignedStopKeysSet.has(stopKey);
    });
    console.log('[GroupForm] Filtered to assigned stops:', groupStops.length);
  }

  // Get base trip date from first trip
  const baseTripDate = trips[0].datum; // "DD.MM.YYYY" format

  // Geographic order for German cities (South to North)
  const CITY_ORDER = [
    // South (Alps/Bavaria)
    'Garmisch', 'Oberstdorf', 'Füssen', 'Konstanz', 'Ulm', 'Augsburg', 'München',
    'Stuttgart', 'Tübingen', 'Karlsruhe', 'Freiburg', 'Heidelberg',
    // Middle
    'Mannheim', 'Frankfurt', 'Mainz', 'Wiesbaden', 'Darmstadt',
    // North Rhine
    'Koblenz', 'Bonn', 'Köln', 'Düsseldorf', 'Essen', 'Duisburg', 'Dortmund',
    // Further North
    'Münster', 'Bielefeld', 'Hannover', 'Bremen', 'Hamburg', 'Lübeck', 'Berlin'
  ];

  // Group stops by location and time, sum passengers, calculate dates
  const aggregatedStops = groupStops.reduce((acc, stop) => {
    const location = stop['Zustieg/Ausstieg'] || 'Unbekannt';
    const stopTime = stop.Zeit || '00:00'; // Use placeholder for stops without time (e.g., Rückfahrt)
    const isRueckfahrt = stop.Beförderung?.toLowerCase().includes('rückfahrt');
    
    // Calculate actual date for this stop (handle overnight trips)
    let stopDate = baseTripDate;
    const hour = parseInt(stopTime.split(':')[0]);
    // If time is before 06:00, assume it's the next day
    if (hour < 6) {
      stopDate = addDays(baseTripDate, 1);
    }
    
    const key = `${stopDate}-${stopTime}-${location}-${isRueckfahrt ? 'rueck' : 'hin'}`;
    if (!acc[key]) {
      acc[key] = {
        date: stopDate,
        time: stop.Zeit || 'Zeit folgt', // Show "Zeit folgt" for stops without time
        datetime: parseGermanDate(stopDate).getTime() + parseInt(stopTime.split(':')[0]) * 3600000 + parseInt(stopTime.split(':')[1]) * 60000,
        location: location,
        passengers: stop.Anzahl || 0,
        isRueckfahrt: isRueckfahrt,
      };
    } else {
      acc[key].passengers += stop.Anzahl || 0;
    }
    return acc;
  }, {} as Record<string, { date: string; time: string; datetime: number; location: string; passengers: number; isRueckfahrt: boolean }>);

  // Separate and sort stops by direction
  const allStops = Object.values(aggregatedStops);
  const hinfahrtStops = allStops.filter(s => !s.isRueckfahrt).sort((a, b) => a.datetime - b.datetime);
  
  const rueckfahrtStops = allStops.filter(s => s.isRueckfahrt).sort((a, b) => {
    // Geographic sorting for return trips (South to North)
    const cityIndexA = CITY_ORDER.findIndex(city => a.location.includes(city));
    const cityIndexB = CITY_ORDER.findIndex(city => b.location.includes(city));
    
    // Unknown cities go to end
    if (cityIndexA === -1 && cityIndexB === -1) return 0;
    if (cityIndexA === -1) return 1;
    if (cityIndexB === -1) return -1;
    
    return cityIndexA - cityIndexB;
  });
  
  // Combine: Hinfahrt first (time-sorted), then Rückfahrt (geographically sorted)
  const sortedStops = [...hinfahrtStops, ...rueckfahrtStops];

  return (
    <div className="space-y-5">
      {isStandbus && (
        <Alert className="bg-orange-50 border-orange-300 border-2">
          <AlertDescription>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <div>
                <strong className="text-orange-700">Standbus-Planung:</strong>
                <p className="text-orange-600 mt-1">
                  Der Bus bleibt vom {hinTrips[0]?.datum} bis {rueckTrips[0]?.datum} vor Ort ({standbusDays} Tage)
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
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
            onValueChange={(value) => {
              const selectedBus = buses.find(b => b.id === value);
              const autoLuggage = selectedBus && selectedBus.seats >= 70 ? 'Anhänger' : 'ohne';
              setBusDetails({ ...busDetails, busId: value, luggage: autoLuggage });
            }}
            disabled={isLocked}
          >
            <SelectTrigger id={`busId-${groupId}`}>
              <SelectValue placeholder="-- Bitte wählen --" />
            </SelectTrigger>
            <SelectContent>
              {buses.map(bus => {
                const tooSmall = hinPax > bus.seats || rueckPax > bus.seats;
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
              <SelectItem value="ohne">ohne</SelectItem>
              <SelectItem value="Koffer">Koffer</SelectItem>
              <SelectItem value="Anhänger">Anhänger</SelectItem>
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
      
      {isLocked && (
        <Alert>
          <AlertDescription>🔒 Diese Busplanung ist gesperrt (nur bei Status 'locked').</AlertDescription>
        </Alert>
      )}

      <SplitDialog
        open={showSplitDialog}
        onOpenChange={setShowSplitDialog}
        trips={trips}
        stops={groupStops}
        buses={buses}
        onSplit={handleSplit}
      />
    </div>
  );
};
