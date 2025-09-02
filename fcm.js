// fcm.js
const { google } = require("googleapis");
const fetch = require("node-fetch");
const serviceAccount = require("./firebase-service-account.json");

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
          data: dataPayload, // Twilio Voice SDK expects "data" payload
        },
      }),
    }
  );

  const result = await response.json();
  console.log("📨 FCM Response:", result);
  return result;
}

module.exports = { sendPushNotification };
