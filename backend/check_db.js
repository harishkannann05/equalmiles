const mongoose = require("mongoose");
const Route = require("./models/Route");

mongoose.connect("mongodb://localhost:27017/equalmiles", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(async () => {
    console.log("Connected to MongoDB");

    // Find the most recent route
    const routes = await Route.find().sort({ createdAt: -1 }).limit(1);

    if (routes.length === 0) {
        console.log("No routes found!");
    } else {
        const route = routes[0];
        console.log(`Checking Route: ${route.region}`);
        console.log(`Total Orders: ${route.orders.length}`);

        // Check first 3 orders
        route.orders.slice(0, 3).forEach((o, i) => {
            console.log(`Order #${i + 1}: ${o.address}`);
            console.log(`   Coordinates:`, o.coordinates);
            console.log(`   Mode: ${o.mode}, Priority: ${o.priority}`);
        });
    }

    mongoose.connection.close();
}).catch(err => console.error(err));
