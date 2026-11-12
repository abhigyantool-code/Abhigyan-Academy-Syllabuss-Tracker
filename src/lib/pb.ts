import PocketBase from 'pocketbase';

const rawUrl = process.env.POCKETBASE_URL || 'https://stracker.abhigyanintelligence.cloud/_/';
const PB_URL = rawUrl.replace(/\/_\/?$/, '').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'abhigyantool2@gmail.com';
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

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
        // Resilient fetch wrapper with retry and backoff for cloud/VPS network blips
        pbInstance.beforeSend = (url, options) => {
          options.fetch = async (reqUrl: any, reqOpts: any) => {
            let lastError: any;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const res = await fetch(reqUrl, reqOpts);
                return res;
              } catch (err: any) {
                lastError = err;
                if (attempt < 3) {
                  await new Promise((r) => setTimeout(r, attempt * 250));
                }
              }
            }
            throw lastError;
          };
          return { url, options };
        };
      }

      if (!pbInstance.authStore.isValid) {
        const adminEmail = process.env.PB_ADMIN_EMAIL || ADMIN_EMAIL;
        const adminPassword = process.env.PB_ADMIN_PASSWORD || ADMIN_PASSWORD;
        if (!adminEmail || !adminPassword) {
          throw new Error('PocketBase credentials missing: please set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in environment.');
        }
        await pbInstance.collection('_superusers').authWithPassword(adminEmail, adminPassword);
      }

      return pbInstance;
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

export { PB_URL };
