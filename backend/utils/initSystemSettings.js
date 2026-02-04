const SystemSettings = require("../models/SystemSettings");

module.exports = async () => {
  const exists = await SystemSettings.findOne();
  if (!exists) {
    await SystemSettings.create({ dutyLocked: false });
    console.log("System settings initialized");
  }
};
