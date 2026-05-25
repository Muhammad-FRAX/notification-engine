import { PublicClientApplication } from '@azure/msal-node';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import config from '../config.js';
import { setProxyAccount, setProxyAccountStatus } from '../repositories/proxyAccount.repo.js';
import { buildMsalConfig, parseMsalAccount } from '../util/msalUtils.js';

export { buildMsalConfig, parseMsalAccount };

const SCOPES = ['Chat.Create', 'ChatMessage.Send'];

export const MSAL_CACHE_PATH = join(config.msalCacheDir, '.msal-cache.json');

let _pca = null;

function getPca() {
  if (!_pca) {
    _pca = new PublicClientApplication(
      buildMsalConfig(config.entraClientId, config.entraTenantId)
    );
  }
  return _pca;
}

function ensureCacheDir() {
  mkdirSync(config.msalCacheDir, { recursive: true });
}

function loadCache() {
  if (existsSync(MSAL_CACHE_PATH)) {
    getPca().getTokenCache().deserialize(readFileSync(MSAL_CACHE_PATH, 'utf-8'));
  }
}

function saveCache() {
  ensureCacheDir();
  writeFileSync(MSAL_CACHE_PATH, getPca().getTokenCache().serialize());
}

/**
 * Returns the first cached MSAL account, or null if the cache is empty.
 * Does not make a network call.
 */
export async function getSignedInAccount() {
  loadCache();
  const accounts = await getPca().getTokenCache().getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

/**
 * Acquires a delegated access token.
 * Tries silent refresh first; falls back to the device-code flow.
 * deviceCodeCallback receives the MSAL DeviceCodeResponse and should surface
 * the verification URL and code to the operator (console log in dev, SSE in prod).
 */
export async function getDelegatedToken(deviceCodeCallback) {
  loadCache();
  const pca = getPca();
  const accounts = await pca.getTokenCache().getAllAccounts();

  if (accounts.length > 0) {
    try {
      const result = await pca.acquireTokenSilent({
        account: accounts[0],
        scopes: SCOPES,
      });
      saveCache();
      return result.accessToken;
    } catch {
      // Silent refresh failed — fall through to device code.
    }
  }

  const cb = deviceCodeCallback ?? ((response) => {
    console.log('[msal] Device code flow started:', response.message);
  });

  const result = await pca.acquireTokenByDeviceCode({ scopes: SCOPES, deviceCodeCallback: cb });
  saveCache();
  return result.accessToken;
}

/**
 * Reads the MSAL cache and upserts the proxy_account row with the signed-in
 * account's oid, UPN, and display name.
 * Called once at server startup; errors are logged but do not prevent boot.
 */
export async function initProxyAccount() {
  try {
    const account = await getSignedInAccount();
    if (!account) {
      await setProxyAccountStatus('signed_out');
      console.log('[msal] No cached account found — proxy account marked signed_out.');
      return null;
    }

    const parsed = parseMsalAccount(account);
    await setProxyAccount({
      ...parsed,
      cachePath: MSAL_CACHE_PATH,
      lastSignInAt: new Date(),
      status: 'signed_in',
    });
    console.log(`[msal] Proxy account restored: ${parsed.upn} (${parsed.aadUserId})`);
    return parsed;
  } catch (err) {
    console.error('[msal] initProxyAccount failed:', err.message);
    return null;
  }
}

/**
 * Clears the MSAL token cache and marks the proxy_account as signed_out.
 */
export async function signOut() {
  const pca = getPca();
  const accounts = await pca.getTokenCache().getAllAccounts();
  for (const account of accounts) {
    await pca.getTokenCache().removeAccount(account);
  }
  saveCache();
  await setProxyAccountStatus('signed_out');
  console.log('[msal] Proxy account signed out.');
}
