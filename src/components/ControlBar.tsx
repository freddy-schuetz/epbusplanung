import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ControlBarProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onLoadData: () => void;
  onSetDateRange: (range: 'season' | 'month') => void;
  filterStatus: string;
  filterDirection: string;
  onFilterStatusChange: (status: string) => void;
  onFilterDirectionChange: (direction: string) => void;
  onToggleAllSections: () => void;
  onCreateGroup: () => void;
  onExportCSV: () => void;
  isLoading: boolean;
}

export const ControlBar = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onLoadData,
  onSetDateRange,
  filterStatus,
  filterDirection,
  onFilterStatusChange,
  onFilterDirectionChange,
  onToggleAllSections,
  onCreateGroup,
  onExportCSV,
  isLoading,
}: ControlBarProps) => {
  return (
    <div className="bg-secondary/50 backdrop-blur-sm p-5 rounded-xl mb-8 sticky top-0 z-50 border border-border shadow-sm">
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="dateFrom" className="text-sm font-medium">Von:</Label>
          <Input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="dateTo" className="text-sm font-medium">Bis:</Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={onLoadData} disabled={isLoading} className="gradient-primary">
          {isLoading ? '⏳ Lädt...' : '📥 Daten laden'}
        </Button>
        <Button onClick={() => onSetDateRange('season')} variant="secondary">
          Ganze Saison
        </Button>
        <Button onClick={() => onSetDateRange('month')} variant="secondary">
          Aktueller Monat
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="filterStatus" className="text-sm font-medium">Status:</Label>
          <Select value={filterStatus} onValueChange={onFilterStatusChange}>
            <SelectTrigger id="filterStatus" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="unplanned">⚪ Ungeplant</SelectItem>
              <SelectItem value="draft">🟡 Entwurf</SelectItem>
              <SelectItem value="completed">✅ Fertig</SelectItem>
              <SelectItem value="locked">🔒 Gesperrt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="filterDirection" className="text-sm font-medium">Richtung:</Label>
          <Select value={filterDirection} onValueChange={onFilterDirectionChange}>
            <SelectTrigger id="filterDirection" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="hin">🟢 Hinfahrten</SelectItem>
              <SelectItem value="rueck">🔴 Rückfahrten</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onToggleAllSections} variant="secondary">
          📅 Alle auf-/zuklappen
        </Button>
        <Button onClick={onCreateGroup} className="bg-success text-success-foreground hover:bg-success/90">
          ➕ Busplanung erstellen
        </Button>
        <Button onClick={onExportCSV} className="bg-warning text-warning-foreground hover:bg-warning/90">
          📥 CSV Export
        </Button>
      </div>
    </div>
  );
};
