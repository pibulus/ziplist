/**
 * ZipList Contributor pricing.
 *
 * Keep this boring on purpose: one clear once-off price, no fake anchor.
 */
export const PRICING = {
  currentPrice: 29,
  currency: "AUD", // Square charge currency; displayed price is 29 once-off
  productName: "ZipList Lifetime Supporter Pass",
  termDays: 36500,

  get displayPrice() {
    return `$${this.currentPrice.toFixed(0)} once-off`;
  },
};

// Contributor buys ROOM, not features. Every feature works free;
// this unlocks 12 lists, multiple simultaneous live rooms, and multi-device sync.
export const CONTRIBUTOR_BENEFITS = [
  "12 lists instead of 3",
  "Run several live rooms at once",
  "Unlock across every device",
  "Lifetime pass (no subscriptions, no renewals)",
];

export const CONTRIBUTOR_COPY = {
  summary:
    "$29 once-off. No subscriptions, no sneaky renewals. Expands to 12 lists, runs multiple live rooms at once, and syncs across every device.",
  checkoutError: "Checkout needs server setup first. Unlock codes still work.",
};
