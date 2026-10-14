// The dispatch sheet: one US Letter page per vehicle, 951 Express branding only. The structure follows Super Dispatch's
// dispatch sheet so it imports there: every field is ONE <Text> run, "Label: value", never a label and a value in
// separate columns. Real text in Helvetica, no images for data. Server-only: rendered with @react-pdf/renderer.
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { DispatchData } from '@/lib/dispatch-data';

const NAVY = '#0E1A2B';
const ORANGE = '#F06A1A';
const GREY = '#5B6573';
const LINE = '#D5DAE1';
const SOFT = '#F3F5F8';

const s = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingHorizontal: 32,
    paddingBottom: 34,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: NAVY,
    lineHeight: 1.2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 3,
    borderBottomColor: ORANGE,
    paddingBottom: 6,
    marginBottom: 6,
  },
  headLeft: { width: '36%' },
  headMid: { width: '28%', alignItems: 'center' },
  headRight: { width: '36%', alignItems: 'flex-end' },
  logo: { width: 71, height: 30, marginBottom: 3 },
  title: { fontSize: 16, lineHeight: 1.1, fontFamily: 'Helvetica-Bold' },
  orderId: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  bold: { fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  section: { marginBottom: 5 },
  h: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: NAVY,
    color: '#FFFFFF',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  box: {
    borderWidth: 1,
    borderColor: LINE,
    borderTopWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  th: { flexDirection: 'row', backgroundColor: SOFT, borderWidth: 1, borderColor: LINE },
  tr: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
  },
  cell: { padding: 4 },
  review: { borderWidth: 1.5, borderColor: ORANGE, padding: 5, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 5,
    fontSize: 8,
    color: GREY,
    textAlign: 'center',
  },
});

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={[s.section, s.col]}>
    <Text style={s.h}>{title}</Text>
    <View style={s.box}>{children}</View>
  </View>
);

/** Each line is one Text run, so "Co. Phone: 9515550100" is read as one line. The first line of a block is bold. */
const Lines = ({ lines, boldFirst = false }: { lines: string[]; boldFirst?: boolean }) => (
  <>
    {lines.map((line, i) => (
      <Text key={`${i}-${line}`} style={i === 0 && boldFirst ? s.bold : undefined}>
        {line}
      </Text>
    ))}
  </>
);

const widths = { n: '6%', v: '34%', t: '14%', c: '14%', vin: '24%', lot: '8%' } as const;

export function DispatchSheet({ d, logo }: { d: DispatchData; logo?: string }) {
  return (
    <Document title={`Dispatch Sheet ${d.ref}`} author="951 Express Inc" creator="951 Express Inc">
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View style={s.headLeft}>
            <Lines lines={d.shipper} boldFirst />
          </View>
          <View style={s.headMid}>
            <Text style={s.orderId}>{`Order ID: ${d.ref}`}</Text>
          </View>
          <View style={s.headRight}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- a react-pdf Image, not an HTML img */}
            {logo ? <Image src={logo} style={s.logo} /> : null}
            <Text style={s.title}>{d.title}</Text>
          </View>
        </View>

        <View style={s.row}>
          <Section title="Carrier Information">
            <Lines lines={d.carrier} />
          </Section>
        </View>

        <View style={s.row}>
          <Section title="Order Information">
            <Lines lines={d.order} />
          </Section>
        </View>

        <View style={s.section}>
          <Text style={s.h}>Vehicle Information</Text>
          <View style={s.box}>
            <Text>{d.totalVehicles}</Text>
          </View>
          <View style={s.th}>
            {(
              [
                ['#', widths.n],
                ['Vehicle', widths.v],
                ['Type', widths.t],
                ['Color', widths.c],
                ['VIN', widths.vin],
                ['Lot #', widths.lot],
              ] as const
            ).map(([label, w]) => (
              <Text key={label} style={[s.cell, s.bold, { width: w }]}>
                {label}
              </Text>
            ))}
          </View>
          <View style={s.tr}>
            <Text style={[s.cell, { width: widths.n }]}>{d.vehicle.n}</Text>
            <Text style={[s.cell, { width: widths.v }]}>{d.vehicle.name}</Text>
            <Text style={[s.cell, { width: widths.t }]}>{d.vehicle.type}</Text>
            <Text style={[s.cell, { width: widths.c }]}>{d.vehicle.color}</Text>
            <Text style={[s.cell, { width: widths.vin }]}>{d.vehicle.vin}</Text>
            <Text style={[s.cell, { width: widths.lot }]}>{d.vehicle.lot}</Text>
          </View>
        </View>

        <View style={s.row}>
          <Section title="Pickup Information">
            <Lines lines={d.pickup} />
          </Section>
          <Section title="Delivery Information">
            <Lines lines={d.delivery} />
          </Section>
        </View>

        <View style={s.section}>
          <Text style={s.h}>DISPATCH INSTRUCTIONS</Text>
          <View style={s.box}>
            {d.instructions.map((line) => (
              <Text key={line} style={{ marginBottom: 1 }}>
                {line}
              </Text>
            ))}
            {d.flags.length > 0 ? (
              <View style={s.review}>
                <Text style={s.bold}>NEEDS REVIEW BEFORE DISPATCH</Text>
                {d.flags.map((f) => (
                  <Text key={f} style={{ marginTop: 2 }}>
                    {`• ${f}`}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <Text style={s.footer} fixed>
          {d.footer}
        </Text>
      </Page>
    </Document>
  );
}
