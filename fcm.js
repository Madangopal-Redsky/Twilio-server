const { google } = require("googleapis");
const fetch = require("node-fetch");

const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
};

async function getAccessToken() {
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ["https://www.googleapis.com/auth/firebase.messaging"],
    null
  );

  const tokens = await jwtClient.authorize();
  return tokens.access_token;
}

async function sendPushNotification(fcmToken, dataPayload) {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          data: dataPayload,
        },
      }),
    }
  );

  const result = await response.json();
  console.log("📨 FCM Response:", result);
  return result;
}

module.exports = { sendPushNotification };
