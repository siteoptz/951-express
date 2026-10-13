// Email copy. TODO(client): review every line with 951 Express.
export const emailCopy = {
  customer: {
    subject: 'Your 951 Express booking is confirmed · Week of {week}',
    preview: 'Your deposit is received and your spot is reserved.',
    heading: "You're booked!",
    intro: 'Thanks for choosing 951 Express. We received your deposit and your spot is reserved.',
    nextStepsHeading: 'What happens next',
    nextSteps: [
      'We review your details and contact you to confirm your pickup date within your reserved week.',
      'Your driver calls you before pickup and before delivery.',
      'You pay the remaining balance to the driver at delivery.',
    ],
    balanceNote: 'The balance is due at delivery.',
    personalItemsHeading: 'Personal items',
    topDeckHeading: 'Why Top Deck Load',
    questions: 'Questions? Reply to this email or write to',
  },
  team: {
    subject: 'New Booking: {vehicle} · {route} · Week of {week} · Deposit Paid',
    preview: 'Deposit paid. Full booking record inside.',
    reviewBanner: 'Review needed',
  },
  lead: {
    subject: 'Quote request ({reasons}): {vehicle} · {route}',
    preview: 'A customer asked for a personalized quote. No deposit, no spot held.',
    heading: 'New quote request',
    note: 'This vehicle has no online price. No deposit was taken and no spot is held.',
    reasonsHeading: 'Why a quote is needed',
    modificationHeading: 'Modifications',
    reasonLabels: {
      large_vehicle: 'large vehicle',
      inoperable: 'inoperable',
      modified: 'modified',
      exotic: 'exotic',
      high_value: 'high value',
    },
  },
} as const;
