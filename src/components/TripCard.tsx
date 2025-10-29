import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from './StatusBadge';
import { Trip, Stop } from '@/types/bus';
import { GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TripCardProps {
  trip: Trip;
  stops: Stop[];
  isSelected: boolean;
  onToggleSelection: (tripId: string) => void;
}

export const TripCard = ({ trip, stops = [], isSelected, onToggleSelection }: TripCardProps) => {
  const [showStops, setShowStops] = useState(false);
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: trip.id,
    data: {
      trip,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  // Extract destination from trip name (e.g., "Davos - Sportclub Weissfluh" → "Davos")
  const extractDestination = (tripName: string) => {
    const parts = tripName.split(' - ');
    return parts[0]?.trim() || 'Ziel';
  };

  // Calculate route display from stops (safely handle undefined/empty stops)
  const filteredStops = (stops || []).filter(
    stop => stop.Reisecode === trip.reisecode && 
    stop.Beförderung?.toLowerCase().includes(trip.direction === 'hin' ? 'hinfahrt' : 'rückfahrt') &&
    stop.Zeit && stop.Zeit.trim() !== ''
  );

  // Parse trip date for datetime calculation
  const [day, month, year] = trip.datum.split('.').map(Number);
  const baseDate = new Date(year, month - 1, day);

  // Helper function to create full datetime for a stop
  const getStopDateTime = (stop: Stop) => {
    const [hours, minutes] = stop.Zeit!.split(':').map(Number);
    const stopDate = new Date(baseDate);
    
    // If early morning (00:00-05:59), assume it's next day for overnight trips
    if (hours < 6) {
      stopDate.setDate(stopDate.getDate() + 1);
    }
    
    stopDate.setHours(hours, minutes, 0, 0);
    return stopDate;
  };

  // Sort by full datetime (not just time string)
  const tripStops = filteredStops.sort((a, b) => {
    const dateA = getStopDateTime(a);
    const dateB = getStopDateTime(b);
    return dateA.getTime() - dateB.getTime();
  });

  const firstStop = tripStops[0]?.['Zustieg/Ausstieg'] || 'Start';
  const destination = extractDestination(trip.reise); // Use actual destination from trip name
  const routeDisplay = tripStops.length > 0 ? `${firstStop} → ${destination}` : trip.reise;
  
  // Get the actual first departure time from sorted stops
  const departureTime = tripStops.length > 0 ? tripStops[0]?.Zeit : trip.uhrzeit;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-card border border-border rounded-lg overflow-hidden transition-all hover:shadow-md"
    >
      <div className="p-2 flex items-center gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(trip.id)}
          className="w-4 h-4 relative z-10"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 hover:bg-accent rounded transition-colors"
          aria-label="Drag to create group"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground font-medium">{departureTime || '--:--'}</span>
            <span className="text-primary font-semibold">{trip.reisecode}</span>
            <StatusBadge status={trip.planningStatus} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span className="font-medium text-foreground">
              {routeDisplay}
            </span>
            <span className="font-semibold text-foreground">{trip.buchungen} PAX</span>
            <span>Kont: {trip.kontingent}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowStops(!showStops);
          }}
          className="p-1 hover:bg-accent rounded transition-colors"
        >
          {showStops ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </div>
      
      {showStops && tripStops.length > 0 && (
        <div className="px-2 pb-2 border-t border-border">
          <div className="space-y-0.5 mt-1.5">
            {tripStops.map((stop, idx) => (
              <div key={idx} className="text-xs flex items-center gap-1.5 py-0.5">
                <span className="text-muted-foreground">🚏</span>
                <span className="font-medium">{stop.Zeit || 'Zeit folgt'}</span>
                <span>{stop['Zustieg/Ausstieg']}</span>
                <span className="text-muted-foreground">-</span>
                <span className="font-semibold">{stop.Anzahl || 0} PAX</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
