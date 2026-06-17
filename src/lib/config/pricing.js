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

export const CONTRIBUTOR_BENEFITS = [
  "More lists",
  "Longer lists",
  "Live shared lists",
  "Unlock on your devices",
];

export const CONTRIBUTOR_COPY = {
  summary:
    "$9 a year, no subscription — get more room and help keep the simple list bit free for everyone.",
  checkoutError:
    "Checkout needs server setup first. Contributor codes still work.",
};
