import Image from 'next/image';
import { company } from '@/config/company';

// Display height by place: header 56px on phones and 72px from md up; footer 80px and 96px. Width follows the ratio.
const sizes = {
  header: 'h-14 md:h-[72px]',
  footer: 'h-20 md:h-24',
} as const;

/** The 951 Express logo. The files are 2x the largest display size, so it is sharp on retina screens. */
export function Logo({
  size = 'header',
  priority = false,
}: {
  size?: 'header' | 'footer';
  priority?: boolean;
}) {
  const l = company.logo[size];
  return (
    <Image
      src={l.src}
      alt={company.logo.alt}
      width={l.width}
      height={l.height}
      priority={priority}
      className={`w-auto ${sizes[size]}`}
    />
  );
}
