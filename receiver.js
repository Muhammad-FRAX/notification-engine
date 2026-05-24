const { PublicClientApplication } = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");
const fs = require("fs");
const path = require("path");

const CLIENT_ID = process.env.CLIENT_ID || "5935a6c7-dea3-4ff2-adf0-fb90e27e2f3c";
const TENANT_ID = process.env.TENANT_ID || "a7853600-5c09-49fd-adca-53fa929e9645";
const SENDER_USER_ID = "b2fe3440-be1b-49c5-a6b2-ac527efeca71";
const TARGET_USER_UPN =
  process.env.TARGET_USER_UPN || "m.alsiddig@sd.zain.com";

const POLL_INTERVAL_MS = 5000;

const SCOPES = ["Chat.Create", "Chat.Read", "ChatMessage.Send"];
const CACHE_PATH = path.join(__dirname, ".msal-cache.json");

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
  },
};

const pca = new PublicClientApplication(msalConfig);

function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    pca.getTokenCache().deserialize(fs.readFileSync(CACHE_PATH, "utf-8"));
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_PATH, pca.getTokenCache().serialize());
}

async function getDelegatedToken() {
  loadCache();

  const accounts = await pca.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    try {
      const silentResult = await pca.acquireTokenSilent({
        account: accounts[0],
        scopes: SCOPES,
      });
      saveCache();
      return silentResult.accessToken;
    } catch (_) {
      // Silent refresh failed — fall through to device code.
    }
  }

  const result = await pca.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      console.log(response.message);
    },
  });

  saveCache();
  return result.accessToken;
}

function createGraphClient(token) {
  return Client.init({
    authProvider: (done) => done(null, token),
  });
}

async function createOneOnOneChat(client, senderUserId, targetUserUpn) {
  const body = {
    chatType: "oneOnOne",
    members: [
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${senderUserId}')`,
      },
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${targetUserUpn}')`,
      },
    ],
  };

  const chat = await client.api("/chats").post(body);
  return chat.id;
}

async function getMessages(client, chatId, since) {
  let request = client
    .api(`/chats/${chatId}/messages`)
    .top(20)
    .orderby("createdDateTime desc");

  if (since) {
    request = request.filter(`createdDateTime gt ${since}`);
  }

  const result = await request.get();
  return result.value;
}

(async () => {
  try {
    const token = await getDelegatedToken();
    const client = createGraphClient(token);
    const chatId = await createOneOnOneChat(client, SENDER_USER_ID, TARGET_USER_UPN);

    console.log(`Listening for messages in chat: ${chatId}`);
    console.log(`Polling every ${POLL_INTERVAL_MS / 1000}s — press Ctrl+C to stop.\n`);

    let lastSeen = new Date().toISOString();

    setInterval(async () => {
      try {
        const messages = await getMessages(client, chatId, lastSeen);

        const incoming = messages
          .filter((m) => m.from?.user?.id !== SENDER_USER_ID)
          .reverse();

        for (const msg of incoming) {
          const sender = msg.from?.user?.displayName || "Unknown";
          const text = msg.body?.content || "";
          const time = msg.createdDateTime;
          console.log(`[${time}] ${sender}: ${text}`);
        }

        if (messages.length > 0) {
          lastSeen = messages[0].createdDateTime;
        }
      } catch (err) {
        console.error("Poll error:", err.message);
      }
    }, POLL_INTERVAL_MS);
  } catch (error) {
    console.error("Receiver error:", error.message);
  }
})();
