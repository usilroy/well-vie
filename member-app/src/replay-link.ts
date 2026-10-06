export const REPLAY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function replayRoute(search: string) {
  const id = new URLSearchParams(search).get('replay');
  return id && REPLAY_ID.test(id) ? '/replay/' + id : null;
}
export function replayLoginRedirect(search: string) {
  const route = replayRoute(search);
  return route ? '/app/?replay=' + route.split('/')[2] : '/app/';
}
