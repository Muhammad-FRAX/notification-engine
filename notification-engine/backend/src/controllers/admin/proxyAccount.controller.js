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
 * SSE endpoint. Opens a persistent HTTP connection and streams two events:
 *   1. `device_code` — { verification_uri, user_code, message } — send to operator
 *   2. `signed_in`   — { upn, display_name, aad_user_id } — sign-in complete
 *   or `error`       — { message } — if the flow fails
 *
 * The MSAL device-code flow can wait up to 15 minutes for the operator to
 * authenticate; the connection stays open for that duration.
 */
export async function startSignIn(req, res, next) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    await getDelegatedToken((deviceCodeResponse) => {
      send('device_code', {
        verification_uri: deviceCodeResponse.verificationUri,
        user_code: deviceCodeResponse.userCode,
        message: deviceCodeResponse.message,
      });
    });

    const account = await getSignedInAccount();
    if (account) {
      const parsed = parseMsalAccount(account);
      await setProxyAccount({
        ...parsed,
        cachePath: MSAL_CACHE_PATH,
        lastSignInAt: new Date(),
        status: 'signed_in',
      });
      send('signed_in', {
        upn: parsed.upn,
        display_name: parsed.displayName,
        aad_user_id: parsed.aadUserId,
      });
    }

    res.end();
  } catch (err) {
    send('error', { message: err.message });
    res.end();
  }
}

export async function signOutHandler(req, res, next) {
  try {
    await signOut();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
