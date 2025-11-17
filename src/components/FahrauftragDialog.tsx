import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trip, BusDetails, Stop } from '@/types/bus';
import { toast } from 'sonner';

interface FahrauftragDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  trips: Trip[];
  busDetails: BusDetails;
  stops: Stop[];
}

export function FahrauftragDialog({ 
  isOpen, 
  onClose, 
  groupId, 
  trips, 
  busDetails, 
  stops 
}: FahrauftragDialogProps) {
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  
  const totalPassengers = trips.reduce((sum, t) => sum + t.buchungen, 0);
  
  const handleSend = async () => {
    setSending(true);
    
    const payload = {
      busGroup: {
        id: groupId,
        trip_number: busDetails.tripNumber || groupId,
        status: trips[0]?.planningStatus || 'completed',
        date: new Date().toISOString()
      },
      trips: trips.map(t => ({
        reisecode: t.reisecode,
        produktcode: t.produktcode,
        reise: t.reise,
        direction: t.direction,
        datum: t.datum,
        uhrzeit: t.uhrzeit,
        passengers: t.buchungen,
        kontingent: t.kontingent
      })),
      busDetails: {
        busId: busDetails.busId,
        kmHinweg: busDetails.kmHinweg,
        kmRueckweg: busDetails.kmRueckweg,
        luggage: busDetails.luggage,
        accommodation: busDetails.accommodation,
        notes: busDetails.notes,
        tripNumber: busDetails.tripNumber
      },
      stops: stops.map(s => ({
        reisecode: s.Reisecode,
        name: s['Zustieg/Ausstieg'],
        time: s.Zeit,
        passengers: s.Anzahl,
        type: s.Beförderung
      })),
      recipientEmail: recipientEmail,
      createdAt: new Date().toISOString()
    };
    
    try {
      const response = await fetch('https://n8n.ep-reisen.app/webhook/fahrauftragserstellung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        toast.success('✅ Fahrauftrag wurde erfolgreich erstellt und gesendet!');
        onClose();
      } else {
        toast.error('❌ Fehler beim Erstellen des Fahrauftrags');
      }
    } catch (error) {
      console.error('Fahrauftrag error:', error);
      toast.error('❌ Verbindungsfehler - Fahrauftrag konnte nicht gesendet werden');
    } finally {
      setSending(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">📋 Fahrauftrag erstellen</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg border">
            <h3 className="font-bold text-lg mb-2">Busplanung Übersicht</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Gruppe:</span>
                <span className="ml-2 font-semibold">{groupId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <Badge className="ml-2" variant="default">
                  {trips[0]?.planningStatus}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <Label htmlFor="recipient-email" className="font-semibold mb-2 block">
              📧 Empfänger E-Mail-Adresse
            </Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="beispiel@busunternehmen.de"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <span>🚌</span>
              <span>Fahrten ({trips.length})</span>
              <Badge variant="secondary">{totalPassengers} PAX gesamt</Badge>
            </h4>
            <div className="space-y-2">
              {trips.map(t => (
                <div key={t.id} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                  <span>{t.direction === 'hin' ? '🟢' : '🔴'}</span>
                  <span className="font-mono text-muted-foreground">{t.datum} {t.uhrzeit}</span>
                  <span className="font-semibold">{t.reisecode}</span>
                  <span className="flex-1">{t.reise}</span>
                  <Badge variant="outline">{t.buchungen} PAX</Badge>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <h4 className="font-semibold mb-3">🚍 Bus-Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Bus ID:</span>
                <span className="ml-2 font-semibold">{busDetails.busId || 'Nicht zugewiesen'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Gepäck:</span>
                <span className="ml-2">{busDetails.luggage || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">KM Hinweg:</span>
                <span className="ml-2">{busDetails.kmHinweg || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">KM Rückweg:</span>
                <span className="ml-2">{busDetails.kmRueckweg || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Fahrerzimmer:</span>
                <span className="ml-2">{busDetails.accommodation || 'N/A'}</span>
              </div>
              {busDetails.notes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Anmerkungen:</span>
                  <p className="mt-1 text-sm bg-muted/30 p-2 rounded">{busDetails.notes}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <h4 className="font-semibold mb-3">📍 Haltestellen ({stops.length})</h4>
            {stops.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {stops
                  .sort((a, b) => {
                    // Convert time strings to comparable values
                    // Times before 06:00 are treated as next day (+24h)
                    const getTimeValue = (time: string) => {
                      const [hours, minutes] = time.split(':').map(Number);
                      return hours < 6 ? hours + 24 : hours;
                    };
                    
                    const timeA = getTimeValue(a.Zeit || '00:00');
                    const timeB = getTimeValue(b.Zeit || '00:00');
                    
                    return timeA - timeB;
                  })
                  .map((stop, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm py-1">
                      <span className="font-mono text-muted-foreground w-16">{stop.Zeit}</span>
                      <span className="flex-1">{stop['Zustieg/Ausstieg'] || 'Unbekannt'}</span>
                      <Badge variant="secondary" className="text-xs">{stop.Anzahl} PAX</Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Keine Haltestellen vorhanden</p>
            )}
          </div>
          
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
            <p className="text-sm">
              ⚠️ Der Fahrauftrag wird an das n8n-System gesendet und kann dort weiterverarbeitet werden.
            </p>
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={sending}
            className="gradient-primary"
          >
            {sending ? '📤 Sende...' : '📋 Fahrauftrag jetzt senden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
