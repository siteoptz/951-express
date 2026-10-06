export function SectionHeading({
  title,
  intro,
  light = false,
}: {
  title: string;
  intro?: string;
  light?: boolean;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <h2 className="font-display text-4xl font-extrabold uppercase leading-none tracking-tight sm:text-5xl">
        {title}
      </h2>
      <div className="mt-4 h-1 w-14 bg-amber" aria-hidden="true" />
      {intro && <p className={`mt-4 text-lg ${light ? 'text-white/80' : 'text-muted'}`}>{intro}</p>}
    </div>
  );
}
