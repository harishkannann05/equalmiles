const mongoose = require("mongoose");

module.exports = mongoose.model(
  "SystemSettings",
  new mongoose.Schema({
    dutyLocked: { type: Boolean, default: false },
    lockedAt: Date,
  }, { timestamps: true })
);
