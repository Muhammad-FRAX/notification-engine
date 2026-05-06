const { PublicClientApplication } = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");

// Configure these with your app/user details.
const CLIENT_ID = process.env.CLIENT_ID || "5935a6c7-dea3-4ff2-adf0-fb90e27e2f3c";
const TENANT_ID = process.env.TENANT_ID || "a7853600-5c09-49fd-adca-53fa929e9645";
const TARGET_USER_UPN =
  process.env.TARGET_USER_UPN || "mohamed.alsiddig@ms.sd.zain.com";

// Delegated scopes (user context).
const SCOPES = ["Chat.Create", "ChatMessage.Send"];

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
  },
};

const pca = new PublicClientApplication(msalConfig);

async function getDelegatedToken() {
  const result = await pca.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      console.log(response.message);
    },
  });

  return result.accessToken;
}

function createGraphClient(token) {
  return Client.init({
    authProvider: (done) => done(null, token),
  });
}

async function createOneOnOneChat(client, targetUserUpn) {
  const body = {
    chatType: "oneOnOne",
    members: [
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        // In delegated flow, the signed-in user is implied.
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
    const chatId = await createOneOnOneChat(client, TARGET_USER_UPN);

    await sendMessageToChat(
      client,
      chatId,
      "<b>Hello from delegated flow</b>"
    );

    console.log("Delegated message sent successfully.");
  } catch (error) {
    console.error("Delegated flow error:", error.message);
  }
})();
