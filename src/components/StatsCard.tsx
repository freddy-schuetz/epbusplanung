interface StatsCardProps {
  value: number;
  label: string;
}

export const StatsCard = ({ value, label }: StatsCardProps) => {
  return (
    <div className="gradient-stat text-white p-6 rounded-xl text-center shadow-lg">
      <h3 className="text-4xl font-bold mb-1">{value}</h3>
      <p className="text-sm opacity-90">{label}</p>
    </div>
  );
};
