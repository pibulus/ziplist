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
  "12 lists, up from 3",
  "Private sync across paired devices",
  "12 shared lists at once, up from 1",
  "Shared links last a year between edits",
];

export const CONTRIBUTOR_COPY = {
  headline: "ZipList",
  headlineHighlight: "Passport",
  tagline: "More room. Private sync. One flat pass.",
  ctaButton: "Grab the ZipList Passport",
  redeemButton: "Already have a Passport key?",
  get priceLine() {
    return `${PRICING.displayPrice} once. No subscription.`;
  },
  get finePrint() {
    return this.priceLine;
  },
  checkoutError: "Checkout needs server setup first. Unlock keys still work.",
};
