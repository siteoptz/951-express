import type { ComponentProps } from 'react';

const base =
  'inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const variants = {
  primary: 'bg-amber text-navy hover:bg-amber-dark',
  ghost: 'border-2 border-white/60 text-white hover:bg-white/10',
  ghostDark: 'border-2 border-navy/30 text-navy hover:bg-navy/5',
};

type Variant = keyof typeof variants;

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'a'> & { variant?: Variant }) {
  return <a className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
