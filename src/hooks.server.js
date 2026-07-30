// ===================================================================
// HOOKS — security headers on every response
// ===================================================================
// The family pattern, matching daysay/talktype/riffrap. ZipList was serving
// only Strict-Transport-Security; the other three were missing entirely.
//
// Referrer-Policy is the one that actually matters here: a live room is
// authorised by knowing its URL (/live/<roomId>), so without this, clicking any
// outbound link from inside a room leaks the room id in the Referer header to
// whoever is on the other end. That is the whole auth model handed over.
//
// No Content-Security-Policy yet, deliberately. ZipList talks to PartyKit over
// wss, Square for checkout and Gemini through its own API route, and a CSP that
// misses one of those white-screens the feature silently with no error anyone
// would connect to this file. It wants its own pass with the origin list
// verified against the live app, not a guess bolted on here.

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event);

	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');

	return response;
}
