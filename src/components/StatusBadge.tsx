import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: 'unplanned' | 'draft' | 'completed' | 'locked';
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const variants = {
    unplanned: { label: '⚪ Ungeplant', className: 'bg-muted text-muted-foreground' },
    draft: { label: '🟡 Entwurf', className: 'bg-warning/20 text-warning-foreground border-warning' },
    completed: { label: '✅ Fertig', className: 'bg-success/20 text-success-foreground border-success' },
    locked: { label: '🔒 Gesperrt', className: 'bg-destructive/20 text-destructive border-destructive' },
  };

  const variant = variants[status];

  return (
    <Badge className={`text-xs font-semibold ${variant.className}`}>
      {variant.label}
    </Badge>
  );
};
