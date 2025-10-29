import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface TransferHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (hubData: any) => void;
  availableTrips?: any[];
  date: string;
}

const HUB_LOCATIONS = ['Frankfurt', 'München', 'Mannheim', 'Stuttgart', 'Nürnberg'];
const START_CITIES = ['Essen', 'Köln', 'Dortmund', 'Hamburg', 'Berlin', 'Bremen'];

export const TransferHubDialog = ({ 
  open, 
  onOpenChange, 
  onSave,
  availableTrips = [],
  date 
}: TransferHubDialogProps) => {
  const [hubLocation, setHubLocation] = useState('Frankfurt');
  const [hubTime, setHubTime] = useState('14:00');
  const [feederBuses, setFeederBuses] = useState<Array<{
    id: string;
    startCity: string;
    selectedTrips: string[];
    totalPax: number;
  }>>([]);

  const handleAddFeederBus = () => {
    setFeederBuses([...feederBuses, {
      id: Math.random().toString(36).substr(2, 9),
      startCity: '',
      selectedTrips: [],
      totalPax: 0
    }]);
  };

  const handleRemoveFeederBus = (id: string) => {
    setFeederBuses(feederBuses.filter(bus => bus.id !== id));
  };

  const handleSave = () => {
    const hubData = {
      type: 'transfer_hub',
      hub_location: hubLocation,
      hub_time: hubTime,
      hub_date: date,
      feeder_buses: feederBuses,
      target_buses: [], // Will be populated in next step
      status: 'draft'
    };
    onSave(hubData);
    onOpenChange(false);
  };

  // Group available trips by destination
  const tripsByDestination = (availableTrips as any[]).reduce((acc, trip) => {
    const destination = trip.reise || 'Unbekannt';
    if (!acc[destination]) {
      acc[destination] = [];
    }
    acc[destination].push(trip);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            🔄 Transfer-Hub planen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Hub Location & Time */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-warning/10 rounded-lg border border-warning/30">
            <div className="space-y-2">
              <Label>Hub-Standort</Label>
              <Select value={hubLocation} onValueChange={setHubLocation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HUB_LOCATIONS.map(location => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transfer-Zeit</Label>
              <Input 
                type="time" 
                value={hubTime} 
                onChange={(e) => setHubTime(e.target.value)}
              />
            </div>
          </div>

          {/* Feeder Buses Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">🚌 Ankommende Busse (Sammelbusse)</h3>
              <Button 
                onClick={handleAddFeederBus}
                size="sm"
                className="bg-success hover:bg-success/90"
              >
                <Plus className="h-4 w-4 mr-1" />
                Sammelbus hinzufügen
              </Button>
            </div>

            {feederBuses.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                Noch keine Sammelbusse hinzugefügt
              </div>
            ) : (
              <div className="space-y-3">
                {feederBuses.map((bus, index) => (
                  <div key={bus.id} className="p-4 bg-success/5 border border-success/30 rounded-lg">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-success">Bus {index + 1}</Badge>
                          <Select 
                            value={bus.startCity} 
                            onValueChange={(value) => {
                              const updated = [...feederBuses];
                              updated[index].startCity = value;
                              setFeederBuses(updated);
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Startstadt wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {START_CITIES.map(city => (
                                <SelectItem key={city} value={city}>
                                  {city}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {bus.totalPax > 0 && (
                            <Badge variant="secondary">
                              {bus.totalPax} PAX
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Ausgewählte Fahrten: {bus.selectedTrips.length}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFeederBus(bus.id)}
                        className="text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Target Buses Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">🎯 Weiterfahrende Busse (nach Ziel)</h3>
            
            {Object.keys(tripsByDestination).length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                Keine verfügbaren Fahrten für dieses Datum
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(tripsByDestination).map(([destination, trips]) => {
                  const totalPax = (trips as any[]).reduce((sum, trip) => sum + (trip.buchungen || 0), 0);
                  return (
                    <div 
                      key={destination}
                      className="p-3 bg-primary/5 border border-primary/30 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Nach {destination}</span>
                          <Badge variant="secondary">{totalPax} PAX</Badge>
                          <span className="text-sm text-muted-foreground">
                            ({(trips as any[]).length} Fahrten)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleSave}
              disabled={feederBuses.length === 0 || !hubLocation || !hubTime}
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              🔄 Transfer-Hub speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
