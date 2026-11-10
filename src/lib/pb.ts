import PocketBase from 'pocketbase';

const rawUrl = process.env.POCKETBASE_URL || 'https://stracker.abhigyanintelligence.cloud/_/';
const PB_URL = rawUrl.replace(/\/_\/?$/, '').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'abhigyantool2@gmail.com';
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'FfZjw97Mpp9gSwp@spb';

let pbInstance: PocketBase | null = null;
let authPromise: Promise<PocketBase> | null = null;

/**
 * Returns a singleton authenticated PocketBase client instance for server-side operations.
 * Auto-cancellation is disabled for multi-request Node.js server environments.
 */
export async function getPbClient(): Promise<PocketBase> {
  if (pbInstance && pbInstance.authStore.isValid) {
    return pbInstance;
  }

  if (authPromise) {
    return authPromise;
  }

  authPromise = (async () => {
    try {
      if (!pbInstance) {
        pbInstance = new PocketBase(PB_URL);
        pbInstance.autoCancellation(false);
      }

      if (!pbInstance.authStore.isValid) {
        if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
          throw new Error('PocketBase credentials missing: please set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in environment.');
        }
        await pbInstance.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
      }

      return pbInstance;
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

export { PB_URL };
