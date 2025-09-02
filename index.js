require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const twilio = require("twilio");

const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());

// Env variables
const {
  PORT,
  MONGO_URI,
  JWT_SECRET,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWILIO_CONVERSATIONS_SERVICE_SID,
  TWIML_App_SID
} = process.env;

// MongoDB connect
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("Mongo error:", err.message));

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ---------------- JWT Auth middleware ----------------
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---------------- Signup ----------------
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    // check duplicate
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashed, phone });
    await user.save();

    res.json({ message: "User created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Login ----------------
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, identity: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, phone: user.phone },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Twilio Conversations Token ----------------
app.post("/token", auth, (req, res) => {
  try {
    const AccessToken = twilio.jwt.AccessToken;

    const ChatGrant = AccessToken.ChatGrant;

    const chatGrant = new ChatGrant({
      serviceSid: TWILIO_CONVERSATIONS_SERVICE_SID,
    });

    console.log("Generating Twilio token for identity:", req.user.identity);

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity: req.user.identity }
    );


    token.addGrant(chatGrant);

    res.json({ token: token.toJwt() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Get users list ----------------
app.get("/users", auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select(
      "username email phone"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const Message = require("./models/Message");

// Save a message
app.post("/messages", auth, async (req, res) => {
  try {
    const { conversationSid, body } = req.body;
    console.log("conversationSid, body", conversationSid, body);
    
    if (!conversationSid || !body) return res.status(400).json({ error: "Missing data" });

    const message = new Message({
      conversationSid,
      author: req.user.identity, // or req.user.id
      body,
    });
    console.log("message::::", message);
    

    await message.save();
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch messages for a conversation
app.get("/messages/:conversationSid", auth, async (req, res) => {
  try {
    const { conversationSid } = req.params;

    const messages = await Message.find({ conversationSid }).sort({ dateCreated: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/voice-token", auth, (req, res) => {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWIML_App_SID,
    incomingAllow: true,
  });

  const token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    { identity: req.user.identity }
  );
  token.addGrant(voiceGrant);

  res.json({ token: token.toJwt() });
});

app.use(express.urlencoded({ extended: false }));

app.post("/twiml", (req, res) => {
  const { To } = req.body;
  const twiml = new twilio.twiml.VoiceResponse();

  if (To) {
    const dial = twiml.dial();
    dial.client(To);
  } else {
    twiml.say("No recipient specified");
  }

  res.type("text/xml");
  res.send(twiml.toString());
});
// const { sendPushNotification } = require("./fcm");

// app.post("/twiml", async (req, res) => {
//   try {
//     const { To, From } = req.body;
//     const twiml = new twilio.twiml.VoiceResponse();
//     console.log("Incoming call:", From, "→", To);

//     if (To) {
//       console.log("Work 1", To)
//       const dial = twiml.dial();
//       dial.client(To);
//       console.log("Work 2", dial.client(To))
//       // 🔔 Push notify "To" user
//       const user = await User.findOne({ username: To });
//       console.log("Work 3", user)
//       if (user && user.fcmToken) {
//         console.log("Work 4", user, user.fcmToken)
//         await sendPushNotification(user.fcmToken, {
//           twi_message_type: "twilio.voice.call",
//           from: From,
//           to: To,
//         });
//         console.log("Work 5")
//       }
//     } else {
//       twiml.say("No recipient specified");
//     }
//     console.log("Work 6")
//     res.type("text/xml");
//     console.log("Work 7");
//     res.send(twiml.toString());
//     console.log("Work 8");
//   } catch (err) {
//     console.error("Error in /twiml:", err.message);
//     res.status(500).send("Internal Server Error");
//   }
// });

app.post("/save-fcm-token", auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: "FCM token missing" });

    await User.findByIdAndUpdate(req.user.id, { fcmToken });
    res.json({ message: "FCM token saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Server ----------------
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
