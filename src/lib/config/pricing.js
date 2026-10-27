/**
 * ZipList Contributor pricing.
 *
 * Keep this boring on purpose: one clear once-off price, no fake anchor.
 */
export const PRICING = {
  currentPrice: 29,
  currency: "AUD", // Square charge currency; displayed price is 29 once-off
  productName: "ZipList Passport",
  termDays: 36500,

  get displayPrice() {
    return `A$${this.currentPrice.toFixed(0)}`;
  },
  get displayPriceShort() {
    return `A$${this.currentPrice.toFixed(0)}`;
  },
};

export const CONTRIBUTOR_BENEFITS = [
  "12 colour lists instead of 3",
  "Encrypted device sync across phone & laptop",
  "Year-long live shared rooms",
  "Holographic Passport card with custom holo skins",
];

export const CONTRIBUTOR_COPY = {
  headline: "Unlock the ZipList",
  headlineHighlight: "Passport",
  tagline: "More room, live sync across devices, one flat pass.",
  ctaButton: "Grab the ZipList Passport",
  redeemButton: "Already have a Passport key?",
  get priceLine() {
    return `${PRICING.displayPrice} once. No subscription, no renewals.`;
  },
  get finePrint() {
    return this.priceLine;
  },
  checkoutError: "Checkout needs server setup first. Unlock keys still work.",
};
