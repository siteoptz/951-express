// The dispatch sheet: one US Letter page, 951 Express branding only. The layout is a grid Super Dispatch imports: a
// label above its value, two sub-columns per half, "--" for a value we do not have. Real text in Helvetica, no images
// for data. Server-only: rendered with @react-pdf/renderer. Every value comes from DispatchData (booking and config).
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { EMPTY, type DispatchData, type DispatchParty } from '@/lib/dispatch-data';

const NAVY = '#0E1A2B';
const GREY = '#5B6573';
const LINE = '#D5DAE1';

const s = StyleSheet.create({
  page: {
    paddingVertical: 28,
    paddingHorizontal: 34,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: NAVY,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    paddingBottom: 6,
    marginBottom: 10,
  },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  page1: { fontSize: 9, color: GREY, marginTop: 2 },
  row: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  half: { flex: 1 },
  h: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 2,
    marginBottom: 4,
  },
  subs: { flexDirection: 'row', gap: 8 },
  sub: { flex: 1 },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: GREY, marginTop: 4 },
  value: { fontSize: 9.5 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 34,
    right: 34,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 5,
    fontSize: 8,
    color: GREY,
    textAlign: 'center',
  },
});

const Lbl = ({ t }: { t: string }) => <Text style={s.label}>{t}</Text>;
const Val = ({ lines }: { lines: string | string[] }) => (
  <>
    {(Array.isArray(lines) ? lines : [lines]).map((l, i) => (
      <Text key={`${i}-${l}`} style={s.value}>
        {l}
      </Text>
    ))}
  </>
);
/** A label above its value lines. */
const Item = ({ label, lines }: { label: string; lines: string | string[] }) => (
  <View wrap={false}>
    <Lbl t={label} />
    <Val lines={lines} />
  </View>
);
/** Two sub-columns side by side, each a label over its lines. */
const Pair = ({ a, b }: { a: [string, string | string[]]; b: [string, string | string[]] }) => (
  <View style={s.subs} wrap={false}>
    <View style={s.sub}>
      <Item label={a[0]} lines={a[1]} />
    </View>
    <View style={s.sub}>
      <Item label={b[0]} lines={b[1]} />
    </View>
  </View>
);
const Half = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={s.half}>
    <Text style={s.h}>{title}</Text>
    {children}
  </View>
);

/** The left sub-column of a party: who and where. The right one: a contact name we do not have, then the phone. */
const where = (p: DispatchParty) => [p.name, p.street, p.city];
const contact = (p: DispatchParty) => [EMPTY, p.phone];

export function DispatchSheet({ d }: { d: DispatchData }) {
  return (
    <Document title={`Dispatch Sheet ${d.ref}`} author="951 Express Inc">
      <Page size="LETTER" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.title}>Dispatch Sheet</Text>
            <Text style={s.page1}>Page 1 of 1</Text>
          </View>
          <Text style={s.title}>{`Load ${d.ref}`}</Text>
        </View>

        <View style={s.row}>
          <Half title="Shipper Info">
            <Pair a={['Shipper', d.shipper.lines]} b={['Contact Info', d.shipper.contact]} />
            <Pair
              a={['Special Number', d.shipper.special]}
              b={['Load Contact Info', d.shipper.loadContact]}
            />
          </Half>
          <Half title="Carrier Info">
            <Pair a={['Carrier', d.carrier.lines]} b={['Contact Info', d.carrier.contact]} />
            <Pair a={['Special Number', d.carrier.special]} b={['Driver', EMPTY]} />
          </Half>
        </View>

        <View style={s.row}>
          <Half title="Origin Info">
            <Pair a={['Origin', where(d.origin)]} b={['Contact Info', contact(d.origin)]} />
            <Pair a={['Location Type', d.locationType]} b={['Buyer Reference Number', EMPTY]} />
          </Half>
          <Half title="Destination Info">
            <Pair
              a={['Destination', where(d.destination)]}
              b={['Contact Info', contact(d.destination)]}
            />
            <Pair a={['Location Type', d.locationType]} b={['Buyer Reference Number', EMPTY]} />
          </Half>
        </View>

        <View style={s.row}>
          <Half title="Dates">
            <Item label="Dispatch Date" lines={d.dispatchDate} />
            <View style={s.subs} wrap={false}>
              <View style={s.sub}>
                <Lbl t="Requested Pick Up" />
                <Text style={s.label}>Estimated</Text>
                <Val lines={d.pickupDate} />
              </View>
              <View style={s.sub}>
                <Lbl t="Requested Delivery" />
                <Text style={s.label}>Estimated</Text>
                <Val lines={d.deliveryDate} />
              </View>
            </View>
          </Half>
          <Half title="Load Info">
            <Item label="Load ID" lines={d.ref} />
            <Item label="Total Price" lines={d.totalPrice} />
            <Item label="Payment Terms" lines={d.paymentTerms} />
          </Half>
        </View>

        <View style={{ marginBottom: 8 }}>
          <Text style={s.h}>Vehicle Info (1 Total)</Text>
          <View style={s.subs}>
            {(
              [
                ['Vehicle Year/Make/Model', d.vehicle.name, 2.2],
                ['VIN', d.vehicle.vin, 1.7],
                ['Max Weight', EMPTY, 1],
                ['Max Dimensions', EMPTY, 1.4],
                ['Critical Notes', EMPTY, 1.2],
              ] as const
            ).map(([l, v, flex]) => (
              <View key={l} style={{ flex }}>
                <Item label={l} lines={v} />
              </View>
            ))}
          </View>
          <View style={s.subs}>
            {(
              [
                ['Vehicle Type', d.vehicle.type, 2.2],
                ['Color', d.vehicle.color, 1.7],
                ['License State/#', EMPTY, 1],
                ['Lot #', EMPTY, 2.6],
              ] as const
            ).map(([l, v, flex]) => (
              <View key={l} style={{ flex }}>
                <Item label={l} lines={v} />
              </View>
            ))}
          </View>
        </View>

        <View>
          <Text style={s.h}>Additional Info</Text>
          <Item label="Load-Specific Terms" lines={d.terms} />
          <Item label="Pre-Dispatch Notes from Customer" lines={d.notes} />
          <Item
            label="Transport Special Instructions"
            lines={[...d.special, ...d.flags.map((f) => `Needs review: ${f}`)]}
          />
        </View>
        <Text style={s.footer} fixed>
          {d.footer}
        </Text>
      </Page>
    </Document>
  );
}
