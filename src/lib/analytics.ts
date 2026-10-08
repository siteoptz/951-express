// Analytics stubs. Phase 9 wires these to Vercel Analytics and GA4; until then they do nothing.
export type AnalyticsEvent =
  'quote_started' | 'route_qualified' | 'route_rejected' | 'quote_viewed' | 'lead_submitted';

export function track(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
): void {
  void event;
  void props;
}
