const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const parseCSV = require("../services/csvService");
const Route = require("../models/Route");
const Admin = require("../models/Admin");
const Driver = require("../models/Driver");
const scoreRoute = require("../services/routeScoring");

const upload = multer({ dest: "uploads/" });
const router = express.Router();

// --- Auth Endpoints ---

// Simplified Admin Login (Hardcoded)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (email === "admin@gmail.com" && password === "1234") {
    // Mock ID for token
    const token = jwt.sign({ id: "admin_id", role: "admin" }, "SECRET_KEY_HACKATHON", { expiresIn: "1d" });
    res.json({ token, admin: { name: "Admin" } });
  } else {
    res.status(400).json({ message: "Invalid credentials" });
  }
});

// Approve Driver
router.patch("/approve-driver/:id", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    driver.isApproved = true;
    await driver.save();
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get Pending Drivers
router.get("/pending-drivers", async (req, res) => {
  try {
    const drivers = await Driver.find({ isApproved: false });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get All Approved Drivers (On & Off Duty)
router.get("/approved-drivers", async (req, res) => {
  try {
    const drivers = await Driver.find({ isApproved: true });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get System Status (Duty Lock)
router.get("/system/status", async (req, res) => {
  try {
    const SystemSettings = require("../models/SystemSettings");
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({ dutyLocked: false });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Toggle Duty Lock
router.post("/system/duty-lock", async (req, res) => {
  try {
    const SystemSettings = require("../models/SystemSettings");
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({ dutyLocked: false });
    }
    settings.dutyLocked = !settings.dutyLocked;
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete Driver
router.delete("/driver/:id", async (req, res) => {
  try {
    await Driver.findByIdAndDelete(req.params.id);
    res.json({ message: "Driver deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete All Routes (Reset)
router.delete("/reset-routes", async (req, res) => {
  try {
    await Route.deleteMany({});
    res.json({ message: "All routes have been cleared." });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get All Routes (For Map Visualization)
router.get("/routes", async (req, res) => {
  try {
    const routes = await Route.find().populate("assignedDriverId");
    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// --- Existing Endpoints ---

router.post("/upload-csv", upload.single("file"), async (req, res) => {
  try {
    const orders = await parseCSV(req.file.path);

    // 1. Get On-Duty Drivers
    const drivers = await Driver.find({ isApproved: true, onDuty: true });
    if (drivers.length === 0) {
      return res.status(400).json({ message: "No drivers on duty! Cannot generate routes." });
    }

    // 2. Split Orders into chunks (Simple distribution for now, can be region-based later)
    const chunkSize = Math.ceil(orders.length / drivers.length);
    const routesData = [];

    for (let i = 0; i < drivers.length; i++) {
      const chunk = orders.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length === 0) continue;

      // Calculate Route Metrics from Chunks
      const totalDist = chunk.length * 2.5; // Mock dist calc per stop
      const totalWeight = chunk.reduce((sum, o) => sum + (o.weight || 0), 0);

      let route = {
        region: `Zone ${String.fromCharCode(65 + i)}`,
        orders: chunk,
        totalDistance: totalDist,
        numberOfStops: chunk.length,
        totalWeight: totalWeight,
        turnCount: chunk.length * 3, // Est turns
        eta: chunk.length * 10,     // Est time
        status: "pending"
      };

      // 3. Score Route
      route.routeHardshipScore = scoreRoute(route);
      routesData.push(route);
    }

    // 4. Assign Routes (Fairness Logic)
    // Import the assigner we created
    const assignRoutes = require("../services/fairAssignment.js");
    const assignments = assignRoutes(drivers, routesData);

    const savedRoutes = [];

    // 5. Save & Update Drivers
    for (const { route, driver } of assignments) {
      // Update Route with Driver
      route.assignedDriverId = driver._id;
      route.status = "assigned";

      const savedRoute = await Route.create(route);
      savedRoutes.push(savedRoute);

      // Update Driver Stats
      // newAverage = (oldAverage * oldTotal + routeScore) / (oldTotal + 1)
      const oldAvg = driver.averageHardshipScore || 0;
      const oldTotal = driver.totalRoutesCompleted || 0;
      const newTotal = oldTotal + 1;
      const newAvg = ((oldAvg * oldTotal) + route.routeHardshipScore) / newTotal;

      driver.totalRoutesCompleted = newTotal;
      driver.averageHardshipScore = newAvg;
      driver.lastAssignedAt = new Date();
      await driver.save();
    }

    res.json({ message: "Routes generated and assigned!", routes: savedRoutes });

  } catch (err) {
    console.error("CSV Upload Error:", err);
    res.status(500).json({ message: "Error processing CSV: " + err.message });
  }
});

module.exports = router;
