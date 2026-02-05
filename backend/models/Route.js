const mongoose = require("mongoose");

module.exports = mongoose.model(
  "Route",
  new mongoose.Schema({
    region: String,
    orders: [
      {
        orderId: String,
        address: String,
        coordinates: {
          lat: Number,
          lng: Number
        },
        weight: Number,
        mode: { type: String, enum: ['apartment', 'house', 'office', 'notmentioned'], default: 'notmentioned' },
        priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
        status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
      }
    ],

    totalDistance: Number,
    numberOfStops: Number,
    totalWeight: Number,
    turnCount: Number,
    eta: Number,

    // Scoring Breakdown
    modeScore: Number,
    priorityScore: Number,

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
