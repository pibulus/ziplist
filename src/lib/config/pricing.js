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
  "12 colour lists instead of 3",
  "Private 4-word sync across every screen",
  "12 live shared lists open for a year",
];

// What someone just bumped into, said back to them. The pitch is the same
// Passport; only the first line changes, so the shop opens where the hunger is.
export const CONTRIBUTOR_REASONS = {
  "max-lists": "That was the third list. Passport holds twelve.",
  "max-live-lists": "One live list at a time for free. Passport runs twelve.",
};

export const CONTRIBUTOR_COPY = {
  headline: "ZipList",
  headlineHighlight: "Passport",
  tagline: "Lists everywhere they need to be.",
  ctaButton: "Get ZipList Passport",
  redeemButton: "Already have a Passport key?",
  get priceHeadline() {
    return `${PRICING.displayPrice} for a year`;
  },
  priceSuffix: "Renew only if it earns it",
  get priceLine() {
    return `${this.priceHeadline} · ${this.priceSuffix}`;
  },
  get finePrint() {
    return this.priceLine;
  },
  checkoutError: "Checkout needs server setup first. Unlock keys still work.",
};
