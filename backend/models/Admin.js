const mongoose = require("mongoose");

module.exports = mongoose.model(
  "Admin",
  new mongoose.Schema({
    name: String,
    email: String,
    passwordHash: String,
  }, { timestamps: true })
);
