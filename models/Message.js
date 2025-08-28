const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  conversationSid: { type: String, required: true },
  author: { type: String, required: true },
  body: { type: String, required: true },
  dateCreated: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
