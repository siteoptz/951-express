import { company } from '@/config/company';
import { Container } from '@/components/ui/Container';
import { Stat } from '@/components/ui/Stat';

export function TrustBar() {
  const items = [
    { value: company.usdot, label: 'USDOT number' },
    { value: company.insuranceCoverage, label: 'Insurance coverage' },
    ...company.stats,
    ...(company.yearsInOperation > 0
      ? [{ value: `${company.yearsInOperation}`, label: 'Years in operation' }]
      : []),
    { value: 'Deposit', label: 'Secured booking' },
  ];
  return (
    <div className="bg-blue-deep py-8">
      <Container>
        <dl className="flex flex-wrap justify-center gap-x-12 gap-y-6">
          {items.map((i) => (
            <div key={i.label} className="min-w-32">
              <Stat value={i.value} label={i.label} />
            </div>
          ))}
        </dl>
      </Container>
    </div>
  );
}
