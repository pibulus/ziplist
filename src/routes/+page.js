// The homepage has no server-side data: no +page.server.js, no load function,
// nothing request-dependent. It was still being rendered by a serverless
// function on every cold start — measured at 3.3s TTFB cold versus 0.4s warm,
// which is the "slow on first load" that never reproduces on the second try.
//
// Prerendering builds this page once at deploy time and serves it as a static
// file from the CDN, so the first visitor pays nothing.
//
// Scope: this flag covers THIS route only. /live/[roomId] stays dynamic (room
// ids cannot be enumerated at build time) and so does everything under /api/*.
//
// If this page ever needs per-request data, delete this file — prerendered HTML
// is frozen at build time and would serve identical bytes to everyone.
export const prerender = true;
