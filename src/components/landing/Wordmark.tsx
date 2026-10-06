import { company } from '@/config/company';

// TODO(client): replace with the logo file once supplied.
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-2xl font-extrabold uppercase tracking-wide ${className}`}>
      {company.wordmark.prefix} <span className="text-amber">{company.wordmark.accent}</span>
    </span>
  );
}
