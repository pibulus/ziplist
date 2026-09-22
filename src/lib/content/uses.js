/* The verticals, in one list.
 *
 * Each is a thing people actually do with ZipList, written like a person
 * describing it to a mate rather than a page trying to rank. They interlink
 * off this array, so adding a use case is one entry plus one route file.
 */
export const USES = [
  { slug: "groceries", nav: "The shop" },
  { slug: "couples", nav: "Two phones" },
  { slug: "packing", nav: "Packing" },
  { slug: "moving", nav: "Moving house" },
  { slug: "gigs", nav: "Load-in" },
];

export const useHref = (slug) => `/for/${slug}`;
