// TODO(client): confirm every value in this file with 951 Express.
export const company = {
  name: '951 Express Inc',
  wordmark: { prefix: '951', accent: 'EXPRESS' },
  phone: '(951) 427-9763',
  phoneHref: 'tel:+19514279763',
  email: '', // TODO(client): public contact email (hidden until set)
  address: {
    street: '', // TODO(client): street address (hidden until set)
    city: 'Corona',
    state: 'CA',
    zip: '', // TODO(client)
  },
  usdot: '4020917',
  mc: '1516594',
  insuranceCoverage: '$750K', // TODO(client)
  yearsInOperation: 0, // TODO(client)
  stats: [
    { label: 'Crashes in 24 months', value: '0' }, // TODO(client): confirm
  ],
} as const;
