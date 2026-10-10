import { company } from '@/config/company';
import { Container } from '@/components/ui/Container';
import { Stat } from '@/components/ui/Stat';

// Only confirmed facts: the USDOT and MC numbers, and the licensing and cargo limit the client gave us.
export function TrustBar() {
  const items = [
    { value: company.usdot, label: 'USDOT number' },
    { value: company.mc, label: 'MC number' },
    { value: 'Licensed & bonded', label: `Cargo limit of ${company.cargoLimit} per occurrence` },
    ...company.confirmedStats,
  ];
  return (
    <div className="bg-blue-deep py-8">
      <Container>
        <dl className="flex flex-wrap justify-center gap-x-12 gap-y-6">
          {items.map((i) => (
            <Stat key={i.label} value={i.value} label={i.label} />
          ))}
        </dl>
      </Container>
    </div>
  );
}
