/**
 * ZipList Contributor pricing.
 *
 * Keep this boring on purpose: one clear once-off price, no fake anchor.
 */
export const PRICING = {
  currentPrice: 9,
  currency: "AUD",
  productName: "ZipList Contributor Pass",

  get displayPrice() {
    return `$${this.currentPrice.toFixed(0)} ${this.currency}`;
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
    "Pay once, get more room, and help keep the simple list bit free for everyone.",
  checkoutError:
    "Checkout needs server setup first. Contributor codes still work.",
};
