import { redirect } from '@sveltejs/kit';

export function load({ params, url }) {
  const roomId = params.roomId;
  const password = url.searchParams.get('pwd');
  
  let targetUrl = `/?list=${roomId}`;
  if (password) {
    targetUrl += `&pwd=${encodeURIComponent(password)}`;
  }
  
  throw redirect(307, targetUrl);
}
