// Pure content, no per-request data — same reasoning as the homepage: build it
// once at deploy time and serve it from the CDN.
export const prerender = true;
