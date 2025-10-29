import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { Trip, Stop } from '@/types/bus';
import { GripVertical, ChevronDown, ChevronRight } from 'lucide-react';

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
  const filteredStops = (stops || []).filter(stop => {
    const matchesReisecode = stop.Reisecode === trip.reisecode;
    const matchesDirection = stop.Beförderung?.toLowerCase().includes(
      trip.direction === 'hin' ? 'hinfahrt' : 'rückfahrt'
    );
    
    // For outbound trips, require a time. For return trips, allow stops without times
    const hasValidTime = trip.direction === 'hin' 
      ? stop.Zeit && stop.Zeit.trim() !== ''
      : true; // Return trips can have stops without times
    
    return matchesReisecode && matchesDirection && hasValidTime;
  });

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
  // For stops without times, sort them at the end
  const tripStops = filteredStops.sort((a, b) => {
    // If either stop doesn't have a time, put it at the end
    if (!a.Zeit || a.Zeit.trim() === '') return 1;
    if (!b.Zeit || b.Zeit.trim() === '') return -1;
    
    const dateA = getStopDateTime(a);
    const dateB = getStopDateTime(b);
    return dateA.getTime() - dateB.getTime();
  });

  const firstStop = tripStops[0]?.['Zustieg/Ausstieg'] || 'Start';
  const lastStop = tripStops[tripStops.length - 1]?.['Zustieg/Ausstieg'] || 'Ziel';
  const destination = extractDestination(trip.reise); // Use actual destination from trip name
  
  // For return trips, reverse the direction (ski resort → home city)
  let routeDisplay;
  if (tripStops.length > 0) {
    if (trip.direction === 'rueck') {
      routeDisplay = `${destination} → ${lastStop}`;
    } else {
      routeDisplay = `${firstStop} → ${destination}`;
    }
  } else {
    routeDisplay = trip.reise;
  }
  
  // Get the actual first departure time from sorted stops
  const departureTime = tripStops.length > 0 ? tripStops[0]?.Zeit : trip.uhrzeit;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-card border border-border rounded-lg overflow-hidden transition-all hover:shadow-md"
    >
      <div className="p-2 flex items-center gap-3 text-sm">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(trip.id)}
          className="w-4 h-4 relative z-10 shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 hover:bg-accent rounded transition-colors shrink-0"
          aria-label="Drag to create group"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-muted-foreground font-medium shrink-0">{departureTime || '--:--'}</span>
        <span className="flex-1 truncate font-medium">{routeDisplay}</span>
        <span className="text-primary font-semibold shrink-0">{trip.reisecode}</span>
        <span className="font-semibold shrink-0">{trip.buchungen} PAX</span>
        <span className="text-muted-foreground shrink-0">Kont: {trip.kontingent}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowStops(!showStops);
          }}
          className="p-1 hover:bg-accent rounded transition-colors shrink-0"
        >
          {showStops ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
