const mongoose = require("mongoose");

module.exports = mongoose.model(
  "Driver",
  new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    passwordHash: String,

    onDuty: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false },

    averageHardshipScore: { type: Number, default: 0 },
    totalRoutesCompleted: { type: Number, default: 0 },

    lastAssignedAt: Date,
  }, { timestamps: true })
);
