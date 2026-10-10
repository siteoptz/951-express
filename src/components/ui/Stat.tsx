/** One fact in a definition list: the label is the term, the value its definition, shown value-first. */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-32 flex-col-reverse text-center">
      <dt className="mt-1 text-sm text-white/80">{label}</dt>
      <dd className="font-display text-3xl font-extrabold text-accent sm:text-4xl">{value}</dd>
    </div>
  );
}
