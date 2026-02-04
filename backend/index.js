const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const initSystemSettings = require("./utils/initSystemSettings");

dotenv.config();
const app = express();
app.use(express.json());

(async () => {
  await connectDB();
  await initSystemSettings();

  app.use("/api/admin", require("./routes/adminRoutes"));
  app.use("/api/drivers", require("./routes/driverRoutes"));
  app.use("/api/routes", require("./routes/routeRoutes"));
  app.use("/api/system", require("./routes/systemRoutes"));

  app.listen(5000, () => console.log("Server running on port 5000"));
})();
