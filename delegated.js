const { PublicClientApplication } = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");
const fs = require("fs");
const path = require("path");

// Configure these with your app/user details.
const CLIENT_ID = process.env.CLIENT_ID || "5935a6c7-dea3-4ff2-adf0-fb90e27e2f3c";
const TENANT_ID = process.env.TENANT_ID || "a7853600-5c09-49fd-adca-53fa929e9645";
const SENDER_USER_ID = "b2fe3440-be1b-49c5-a6b2-ac527efeca71"; // biadmin@sd.zain.com
const TARGET_USER_UPN =
  process.env.TARGET_USER_UPN || "m.alsiddig@sd.zain.com";

// Delegated scopes (user context).
const SCOPES = ["Chat.Create", "ChatMessage.Send"];

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

async function sendMessageToChat(client, chatId, content) {
  const chatMessage = {
    body: {
      contentType: "html",
      content,
    },
  };

  await client.api(`/chats/${chatId}/messages`).post(chatMessage);
}

(async () => {
  try {
    const token = await getDelegatedToken();
    const client = createGraphClient(token);
    const chatId = await createOneOnOneChat(client, SENDER_USER_ID, TARGET_USER_UPN);

    await sendMessageToChat(
      client,
      chatId,
      "Hello from delegated flow, Welcome to the other side Frax"
    );

    console.log("Delegated message sent successfully.");
  } catch (error) {
    console.error("Delegated flow error:", error.message);
  }
})();
