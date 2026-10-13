// The dispatch sheet: one US Letter page per vehicle, 951 Express branding only. The field layout follows the sheet
// Cal enters bookings from. Server-only: it is rendered with @react-pdf/renderer when a booking is completed.
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { DispatchData, DispatchParty } from '@/lib/dispatch-data';

const NAVY = '#0E1A2B';
const ORANGE = '#F06A1A';
const GREY = '#5B6573';
const LINE = '#D5DAE1';
const SOFT = '#F3F5F8';

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 32,
    paddingBottom: 44,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: NAVY,
    lineHeight: 1.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: ORANGE,
    paddingBottom: 8,
    marginBottom: 10,
  },
  logo: { width: 95, height: 40 },
  title: { fontSize: 20, lineHeight: 1.1, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  orderId: { fontSize: 10, marginTop: 4, textAlign: 'right', color: GREY },
  row: { flexDirection: 'row', gap: 10, marginBottom: 7 },
  col: { flex: 1 },
  box: { borderWidth: 1, borderColor: LINE, padding: 6 },
  h: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    backgroundColor: NAVY,
    color: '#FFFFFF',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  label: { color: GREY, fontSize: 7.5 },
  bold: { fontFamily: 'Helvetica-Bold' },
  big: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  flag: {
    backgroundColor: ORANGE,
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 3,
  },
  th: { flexDirection: 'row', backgroundColor: SOFT, borderWidth: 1, borderColor: LINE },
  tr: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
  },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: LINE },
  review: { borderWidth: 1.5, borderColor: ORANGE, padding: 6, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 20,
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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', marginTop: 2 }}>
    <Text style={[s.label, { width: 74, paddingTop: 0.5 }]}>{label}</Text>
    <Text style={{ flex: 1 }}>{children}</Text>
  </View>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={s.col}>
    <Text style={s.h}>{title}</Text>
    <View style={s.box}>{children}</View>
  </View>
);

const Party = ({ title, p }: { title: string; p: DispatchParty }) => (
  <Section title={title}>
    <Text style={s.big}>{p.name}</Text>
    <Field label="Address">{p.address}</Field>
    <Field label="Phone">{p.phone}</Field>
    <Field label="Contact">{p.contactNote}</Field>
  </Section>
);

const widths = { n: '5%', v: '31%', t: '16%', c: '12%', vin: '28%', lot: '8%' } as const;

export function DispatchSheet({ d, logo }: { d: DispatchData; logo?: string }) {
  return (
    <Document title={`Dispatch Sheet ${d.ref}`} author={d.carrier.name} creator={d.carrier.name}>
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- a react-pdf Image, not an HTML img */}
          {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.big}>{d.carrier.name}</Text>}
          <View>
            <Text style={s.title}>{d.title}</Text>
            <Text style={s.orderId}>Order ID: {d.ref}</Text>
          </View>
        </View>

        <View style={s.row}>
          <Section title="Shipper (customer)">
            <Text style={s.big}>{d.shipper.name}</Text>
            <Field label="Phone">{d.shipper.phone}</Field>
            <Field label="Email">{d.shipper.email}</Field>
            {d.shipper.address ? <Field label="Address">{d.shipper.address}</Field> : null}
          </Section>
          <Section title="Carrier information">
            <Text style={s.big}>{d.carrier.name}</Text>
            <Field label="Authority">{`${d.carrier.usdot}  ·  ${d.carrier.mc}`}</Field>
            {d.carrier.address ? <Field label="Address">{d.carrier.address}</Field> : null}
            <Field label="Dispatch email">{d.carrier.email}</Field>
          </Section>
        </View>

        <View style={s.row}>
          <Section title="Order information">
            <Field label="Booked">{d.order.booked}</Field>
            <Field label="Route">{d.order.route}</Field>
            <Field label="Estimated pickup">{d.order.pickup}</Field>
            <Field label="Estimated delivery">{d.order.delivery}</Field>
            <Field label="Ship via">{d.order.shipVia}</Field>
            <View style={{ flexDirection: 'row', marginTop: 2 }}>
              <Text style={[s.label, { width: 74, paddingTop: 0.5 }]}>Load type</Text>
              <Text style={d.order.topDeck ? s.flag : s.bold}>{d.order.loadType}</Text>
            </View>
          </Section>
          <Section title="Payment">
            <Field label="Total price">{d.payment.total}</Field>
            <Field label="Deposit">{d.payment.deposit}</Field>
            <View style={{ marginTop: 3 }}>
              <Text style={s.label}>Balance to collect at delivery</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold' }}>
                {d.payment.balance}
              </Text>
            </View>
            <Text style={[s.bold, { marginTop: 4 }]}>{d.payment.method}</Text>
          </Section>
        </View>

        <View style={{ marginBottom: 8 }}>
          <Text style={s.h}>Vehicle</Text>
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
            <View style={[s.cell, { width: widths.v }]}>
              <Text style={s.bold}>{d.vehicle.name}</Text>
              {d.vehicle.typedNote ? <Text style={s.label}>{d.vehicle.typedNote}</Text> : null}
            </View>
            <Text style={[s.cell, { width: widths.t }]}>{d.vehicle.type}</Text>
            <Text style={[s.cell, { width: widths.c }]}>{d.vehicle.color}</Text>
            <Text style={[s.cell, { width: widths.vin }]}>{d.vehicle.vin}</Text>
            <Text style={[s.cell, { width: widths.lot, borderRightWidth: 0 }]}>
              {d.vehicle.lot}
            </Text>
          </View>
        </View>

        <View style={s.row}>
          <Party title="Pickup information" p={d.pickup} />
          <Party title="Delivery information" p={d.delivery} />
        </View>

        <View>
          <Text style={s.h}>Dispatch instructions</Text>
          <View style={s.box}>
            {d.instructions.map((line) => (
              <Text key={line} style={{ marginBottom: 2 }}>
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
