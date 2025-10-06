import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from './StatusBadge';
import { Trip } from '@/types/bus';

interface TripCardProps {
  trip: Trip;
  isSelected: boolean;
  onToggleSelection: (tripId: string) => void;
}

export const TripCard = ({ trip, isSelected, onToggleSelection }: TripCardProps) => {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card border-2 border-border rounded-lg overflow-hidden transition-all hover:shadow-md"
    >
      <div className="p-4 flex items-center gap-4">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(trip.id)}
          className="w-5 h-5"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-muted-foreground font-medium">{trip.uhrzeit || '--:--'}</span>
            <span className="text-primary font-semibold">{trip.reisecode}</span>
            <StatusBadge status={trip.planningStatus} />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span>
              {trip.reise} {trip.produktcode && `(${trip.produktcode})`}
            </span>
            <span className="font-semibold text-foreground">{trip.buchungen} PAX</span>
            <span>Kont: {trip.kontingent}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
