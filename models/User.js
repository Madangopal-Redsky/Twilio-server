const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed
  phone: { type: String, required: true, unique: true },
  fcmToken: {type: String, required: true, unique: true},
});

module.exports = mongoose.model("User", userSchema);
