import {
  getDelegatedToken,
  getSignedInAccount,
  signOut,
  parseMsalAccount,
  MSAL_CACHE_PATH,
} from '../../integrations/msal.service.js';
import { getProxyAccount, setProxyAccount } from '../../repositories/proxyAccount.repo.js';

export async function getStatus(req, res, next) {
  try {
    const row = await getProxyAccount();
    res.json(row ?? { status: 'signed_out' });
  } catch (err) {
    next(err);
  }
}

/**
 * Starts the MSAL device-code flow.
 * Responds with JSON { verification_uri, user_code, message } as soon as MSAL
 * surfaces the device code (typically <1s). The actual token acquisition
 * continues in the background — when the operator finishes signing in via the
 * browser, the proxy_account row is updated to status='signed_in'. The frontend
 * polls GET /admin/proxy-account to detect completion.
 *
 * Edge cases:
 *   - Silent refresh succeeds (cached token still valid): no device code is
 *     emitted; respond with { already_signed_in: true } once persisted.
 *   - MSAL fails before emitting a device code: respond 500.
 */
export async function startSignIn(req, res, next) {
  let responded = false;

  function respond(status, body) {
    if (responded) return;
    responded = true;
    res.status(status).json(body);
  }

  const tokenPromise = getDelegatedToken((deviceCodeResponse) => {
    respond(200, {
      verification_uri: deviceCodeResponse.verificationUri,
      user_code: deviceCodeResponse.userCode,
      message: deviceCodeResponse.message,
    });
  });

  tokenPromise
    .then(async () => {
      try {
        const account = await getSignedInAccount();
        if (account) {
          const parsed = parseMsalAccount(account);
          await setProxyAccount({
            ...parsed,
            cachePath: MSAL_CACHE_PATH,
            lastSignInAt: new Date(),
            status: 'signed_in',
          });
          console.log(`[msal] Proxy account signed in: ${parsed.upn}`);
        }
        // Silent-refresh path: callback never fired, respond now.
        respond(200, { already_signed_in: true });
      } catch (err) {
        console.error('[msal] Persist signed-in account failed:', err.message);
        respond(500, { error: 'persist_failed', message: err.message });
      }
    })
    .catch((err) => {
      console.error('[msal] Device code flow failed:', err.message);
      respond(500, { error: 'sign_in_failed', message: err.message });
    });
}

export async function signOutHandler(req, res, next) {
  try {
    await signOut();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
