const mongoose = require("mongoose");

module.exports = mongoose.model(
  "Route",
  new mongoose.Schema({
    region: String,
    orders: Array,

    totalDistance: Number,
    numberOfStops: Number,
    totalWeight: Number,
    turnCount: Number,
    eta: Number,

    routeHardshipScore: Number,
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
    },

    status: {
      type: String,
      enum: ["pending", "assigned", "completed"],
      default: "pending",
    },
  }, { timestamps: true })
);
