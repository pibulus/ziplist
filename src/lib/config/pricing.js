/**
 * ZipList Contributor pricing.
 *
 * Keep this boring on purpose: one clear yearly price, no fake anchor.
 */
export const PRICING = {
  currentPrice: 29,
  currency: "AUD", // Square charge currency; displayed price is 29 for 12 months
  productName: "ZipList Passport",
  termDays: 365,

  get displayPrice() {
    return `A$${this.currentPrice.toFixed(0)}`;
  },
  get displayPriceShort() {
    return `A$${this.currentPrice.toFixed(0)}`;
  },
};

export const CONTRIBUTOR_BENEFITS = [
  "Room for twelve lists instead of three",
  "Lists that follow you between devices",
  "Twelve live shared lists at once, not one",
  "Shared links stay open for a year",
];

export const CONTRIBUTOR_COPY = {
  headline: "ZipList",
  headlineHighlight: "Passport",
  tagline: "Your lists, everywhere they need to be.",
  ctaButton: "Get your Passport",
  redeemButton: "Already have a Passport key?",
  get priceLine() {
    return `${PRICING.displayPrice} for a year. Renew only if it earns it.`;
  },
  get finePrint() {
    return this.priceLine;
  },
  checkoutError: "Checkout needs server setup first. Unlock keys still work.",
};
