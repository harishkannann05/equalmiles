const express = require("express");
const Driver = require("../models/Driver");
const Route = require("../models/Route");
const assign = require("../services/fairAssignment");

const router = express.Router();

router.post("/assign", async (req, res) => {
    const drivers = await Driver.find({ onDuty: true, isActive: true });
    const routes = await Route.find({ status: "pending" });

    const assignments = assign(drivers, routes);

    for (const a of assignments) {
        a.route.assignedDriverId = a.driver._id;
        a.route.status = "assigned";
        await a.route.save();

        a.driver.totalRoutesCompleted++;
        a.driver.averageHardshipScore =
            (a.driver.averageHardshipScore + a.route.routeHardshipScore) / 2;
        await a.driver.save();
    }

    res.json(assignments);
});

router.get("/driver/:driverId", async (req, res) => {
    try {
        // Find route where assignedDriverId matches and status is not completed (or just get the latest)
        // Logic says "assigned" status.
        const route = await Route.findOne({
            assignedDriverId: req.params.driverId,
            status: "assigned"
        });

        // If no assigned, check pending? No, driver only sees assigned.
        // If completed? Maybe.
        // For now, return the active route.

        if (!route) return res.json(null); // No route assigned
        res.json(route);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// Update Stop Status
router.patch("/:routeId/stop-status", async (req, res) => {
    try {
        const { routeId } = req.params;
        const { index, status } = req.body;

        const route = await Route.findById(routeId);
        if (!route) return res.status(404).json({ message: "Route not found" });

        if (!route.orders[index]) return res.status(400).json({ message: "Invalid stop index" });

        route.orders[index].status = status;

        // Check if all stops completed
        const allCompleted = route.orders.every(o => o.status === 'completed');
        if (allCompleted) {
            route.status = 'completed';
        } else {
            route.status = 'assigned';
        }

        await route.save();
        res.json(route);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
