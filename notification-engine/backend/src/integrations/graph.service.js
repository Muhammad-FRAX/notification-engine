import { Client } from '@microsoft/microsoft-graph-client';
import { getDelegatedToken } from './msal.service.js';

/**
 * Builds the Graph API message payload from an HTML body string and optional extras.
 *
 * attachments: array of Graph attachment objects ({ id, contentType, content }) —
 *   for adaptive cards, the id must already be referenced in htmlBody via
 *   <attachment id="{id}"></attachment>
 * hostedContents: array of { tempId, base64, mimeType } — tempIds must already
 *   be referenced in htmlBody via <img src="../hostedContents/{tempId}/$value"/>
 */
export function buildMessagePayload(htmlBody, { attachments = [], hostedContents = [] } = {}) {
  const payload = {
    body: {
      contentType: 'html',
      content: htmlBody,
    },
  };

  if (attachments.length > 0) {
    payload.attachments = attachments;
  }

  if (hostedContents.length > 0) {
    payload.hostedContents = hostedContents.map(({ tempId, base64, mimeType = 'image/png' }) => ({
      '@microsoft.graph.temporaryId': String(tempId),
      contentBytes: base64,
      contentType: mimeType,
    }));
  }

  return payload;
}

async function getClient() {
  const token = await getDelegatedToken();
  return Client.init({
    authProvider: (done) => done(null, token),
  });
}

/**
 * Creates (or retrieves) a 1:1 chat between the proxy user and a target.
 * senderOid: Entra object id of the proxy account (from proxy_account table)
 * targetUpn: UPN or Entra oid of the target recipient
 * Returns the chat id string.
 */
export async function createOneOnOneChat(senderOid, targetUpn) {
  const client = await getClient();
  const chat = await client.api('/chats').post({
    chatType: 'oneOnOne',
    members: [
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${senderOid}')`,
      },
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${targetUpn}')`,
      },
    ],
  });
  return chat.id;
}

/**
 * Sends a message to a 1:1 or group chat.
 * opts: { attachments, hostedContents } — see buildMessagePayload
 * Returns the Graph message object (includes id and createdDateTime).
 */
export async function sendChatMessage(chatId, htmlBody, opts = {}) {
  const client = await getClient();
  const payload = buildMessagePayload(htmlBody, opts);
  return client.api(`/chats/${chatId}/messages`).post(payload);
}

/**
 * Sends a message to a Teams channel.
 * The proxy user must already be a member of the target team.
 * opts: { attachments, hostedContents } — see buildMessagePayload
 * Returns the Graph message object.
 */
export async function sendChannelMessage(teamId, channelId, htmlBody, opts = {}) {
  const client = await getClient();
  const payload = buildMessagePayload(htmlBody, opts);
  return client.api(`/teams/${teamId}/channels/${channelId}/messages`).post(payload);
}
