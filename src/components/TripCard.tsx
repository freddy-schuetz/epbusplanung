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
  const tripStops = (stops || []).filter(
    stop => stop.Reisecode === trip.reisecode && 
    stop.Beförderung?.toLowerCase().includes(trip.direction === 'hin' ? 'hinfahrt' : 'rückfahrt') &&
    stop.Zeit && stop.Zeit.trim() !== ''
  ).sort((a, b) => (a.Zeit || '').localeCompare(b.Zeit || ''));

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
