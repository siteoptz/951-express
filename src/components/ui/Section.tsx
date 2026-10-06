import { Container } from './Container';

export function Section({
  id,
  tone = 'white',
  className = '',
  children,
}: {
  id?: string;
  tone?: 'white' | 'soft' | 'navy';
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    white: 'bg-white text-ink',
    soft: 'bg-soft text-ink',
    navy: 'bg-navy text-white',
  };
  return (
    <section id={id} className={`scroll-mt-20 py-16 sm:py-24 ${tones[tone]} ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}
