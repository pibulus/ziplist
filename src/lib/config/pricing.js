/**
 * ZipList Contributor pricing.
 *
 * Keep this boring on purpose: one clear once-off price, no fake anchor.
 */
export const PRICING = {
  currentPrice: 9,
  currency: "AUD", // Square charge currency; displayed price is just "$9" (≈ same in USD)
  productName: "ZipList Contributor Pass",
  termDays: 365,

  get displayPrice() {
    return `$${this.currentPrice.toFixed(0)}`;
  },
};

// Contributor buys ROOM, not features (2026-07-21). Every feature works
// free — "Live shared lists" and "Longer lists" used to sit here but
// neither was ever actually gated (list length is a soft nudge for
// everyone), and live sharing is now free too. Claiming a benefit the
// free tier already has reads as a bait once someone notices.
export const CONTRIBUTOR_BENEFITS = [
  "12 lists instead of 3",
  "Several lists live at once",
  "Unlock on your devices",
];

export const CONTRIBUTOR_COPY = {
  summary:
    "$9 a year, no subscription — every feature is free, this just buys more room and keeps ZipList going.",
  checkoutError:
    "Checkout needs server setup first. Contributor codes still work.",
};
