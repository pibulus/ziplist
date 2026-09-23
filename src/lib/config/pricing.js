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
};

// Contributor buys ROOM, not features. Every feature works free; this unlocks
// 12 lists and multiple simultaneous live rooms. NOT "multi-device sync" —
// this comment claimed that for months and nothing implements it. A room
// holds one list, so a phrase carries one list. The unlock itself does travel
// between devices, via a code; the lists do not.
export const CONTRIBUTOR_BENEFITS = [
  "12 lists instead of 3",
  "Several live rooms at once",
  "Every device, one unlock",
  "Paid once, kept for good",
];

export const CONTRIBUTOR_COPY = {
  // The price is stated exactly once, under the button, and the button is a
  // verb. It used to run three times — in a summary paragraph, in a bullet,
  // and shouted on the button itself — which is pure pain-of-paying for no
  // information; Square states it again at checkout anyway. Stating it zero
  // times would be the other failure: nobody should meet a price only after
  // committing to the button. Once, quietly, next to the action.
  get priceLine() {
    // Derived, never typed twice: the displayed price and the price Square
    // actually charges both come from PRICING.currentPrice.
    return `$${PRICING.currentPrice} once. No subscription, no renewals.`;
  },
  checkoutError: "Checkout needs server setup first. Unlock codes still work.",
};
