import { useDroppable } from '@dnd-kit/core';

interface DropZoneProps {
  id: string;
  label: string;
}

export const DropZone = ({ id, label }: DropZoneProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        border-2 border-dashed rounded-lg p-6 mb-4 transition-all duration-200
        ${isOver 
          ? 'border-primary bg-primary/20 scale-105 shadow-lg' 
          : 'border-border bg-muted/30 hover:border-primary/50'
        }
      `}
    >
      <div className="text-center">
        <p className={`font-semibold ${isOver ? 'text-primary' : 'text-muted-foreground'}`}>
          {isOver ? '🎯 Hier ablegen' : label}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isOver ? 'Busplanung wird erstellt' : 'Ziehen Sie Reisen hierher'}
        </p>
      </div>
    </div>
  );
};
