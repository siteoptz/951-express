export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl font-extrabold text-amber sm:text-4xl">{value}</div>
      <div className="mt-1 text-sm text-white/80">{label}</div>
    </div>
  );
}
