const express = require("express");
const SystemSettings = require("../models/SystemSettings");

const router = express.Router();

router.get("/status", async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();
        // Default to false if not found (though init should handle it)
        res.json({ dutyLocked: settings ? settings.dutyLocked : false });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
