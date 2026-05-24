/**
 * Pure MSAL helper functions.
 * No I/O, no MSAL package import — safe to unit-test in isolation.
 */

export function buildMsalConfig(clientId, tenantId) {
  if (!clientId) throw new Error('clientId is required');
  if (!tenantId) throw new Error('tenantId is required');
  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  };
}

/**
 * Maps an MSAL AccountInfo object to our domain shape.
 * localAccountId is the Entra oid for single-tenant apps.
 */
export function parseMsalAccount(account) {
  if (!account) throw new Error('account is required');
  return {
    upn: account.username,
    aadUserId: account.localAccountId,
    displayName: account.name ?? account.username,
  };
}
