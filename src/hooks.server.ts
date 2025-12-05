/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({ error, event }) {
  console.error('Server-side error:', error);
  console.error('Path:', event.url.pathname);
  
  return {
    message: 'Internal Server Error',
    code: 'INTERNAL_SERVER_ERROR'
  };
}
