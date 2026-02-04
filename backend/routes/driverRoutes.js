const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Driver = require("../models/Driver");
const SystemSettings = require("../models/SystemSettings");

const router = express.Router();

// Driver Signup (Self-Service)
router.post("/signup", async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const existing = await Driver.findOne({ email });
    if (existing) return res.status(400).json({ message: "Driver already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    // Create as unapproved by default
    const driver = await Driver.create({ name, email, phone, passwordHash, isApproved: false });

    res.json({ message: "Signup successful. Wait for admin approval." });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const driver = await Driver.findOne({ email });
    if (!driver) return res.status(400).json({ message: "Driver not found" });

    const isMatch = await bcrypt.compare(password, driver.passwordHash);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    if (!driver.isApproved) return res.status(403).json({ message: "Account pending approval. Please contact admin." });

    const token = jwt.sign({ id: driver._id, role: "driver" }, "SECRET_KEY_HACKATHON", { expiresIn: "1d" });
    res.json({ token, driverId: driver._id });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/duty", async (req, res) => {
  const system = await SystemSettings.findOne();
  if (system.dutyLocked)
    return res.status(403).json({ message: "Duty locked" });

  const driver = await Driver.findById(req.params.id);
  driver.onDuty = !driver.onDuty;
  await driver.save();

  res.json(driver);
});

router.get("/", async (req, res) => {
  const drivers = await Driver.find();
  res.json(drivers);
});

router.get("/:id", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
