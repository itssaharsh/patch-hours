// Where the Patch Hours API lives. The virtual device reaches the dev machine at 10.0.2.2.
export const API_BASE = 'https://patch-hours.vercel.app';
export const DEV_API_BASE = 'http://10.0.2.2:3107';
export const USE_DEV = false;
export const API = USE_DEV ? DEV_API_BASE : API_BASE;
export const VIDEO_URL = `${API}/bunny-tv.mp4`;
export const SHOW_PLAYER_CLOCK = false; // dev aid: shows the player's state and clock
export const VIDEO_CREDIT = 'Big Buck Bunny · Blender Foundation · CC BY 3.0';
