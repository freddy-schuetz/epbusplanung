import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from './StatusBadge';
import { Trip, Stop } from '@/types/bus';
import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TripCardProps {
  trip: Trip;
  stops: Stop[];
  isSelected: boolean;
  onToggleSelection: (tripId: string) => void;
}

export const TripCard = ({ trip, stops = [], isSelected, onToggleSelection }: TripCardProps) => {
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
  const lastStop = tripStops[tripStops.length - 1]?.['Zustieg/Ausstieg'] || 'Ziel';
  const routeDisplay = tripStops.length > 0 ? `${firstStop} → ${lastStop}` : trip.reise;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-card border-2 border-border rounded-lg overflow-hidden transition-all hover:shadow-md"
    >
      <div className="p-4 flex items-center gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(trip.id)}
          className="w-5 h-5 relative z-10"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-accent rounded transition-colors"
          aria-label="Drag to create group"
        >
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-muted-foreground font-medium">{trip.uhrzeit || '--:--'}</span>
            <span className="text-primary font-semibold">{trip.reisecode}</span>
            {trip.produktcode && (
              <Badge variant="secondary" className="font-semibold">
                {trip.produktcode}
              </Badge>
            )}
            <StatusBadge status={trip.planningStatus} />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className="font-medium text-foreground">
              {routeDisplay}
            </span>
            <span className="font-semibold text-foreground">{trip.buchungen} PAX</span>
            <span>Kont: {trip.kontingent}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
