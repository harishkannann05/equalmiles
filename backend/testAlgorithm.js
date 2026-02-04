const mongoose = require("mongoose");
const parseCSV = require("./services/csvService");
const scoreRoute = require("./services/routeScoring");
const assignRoutes = require("./services/fairAssignment");
const Driver = require("./models/Driver");
const Route = require("./models/Route");
const path = require("path");

// Mock Data for Consistency
const TEST_DRIVERS = [
    { name: "Alice (New)", averageHardshipScore: 0, totalRoutesCompleted: 0, onDuty: true, isActive: true },
    { name: "Bob (Mid)", averageHardshipScore: 30, totalRoutesCompleted: 10, onDuty: true, isActive: true },
    { name: "Charlie (Pro)", averageHardshipScore: 50, totalRoutesCompleted: 50, onDuty: true, isActive: true }
];

const runTest = async () => {
    try {
        console.log("🚀 Starting Algorithm Verification...\n");

        // 1. Mock Drivers
        console.log("👥 1. Mocking On-Duty Drivers:");
        TEST_DRIVERS.forEach(d => {
            const fairness = (d.averageHardshipScore * Math.log(d.totalRoutesCompleted + 1)).toFixed(2);
            console.log(`   - ${d.name}: Avg=${d.averageHardshipScore}, Total=${d.totalRoutesCompleted} => Fairness Score: ${fairness}`);
        });

        // 2. Parse CSV
        const csvPath = path.join(__dirname, "../sample_orders.csv"); // Adjust path if needed
        console.log(`\n📂 2. Reading CSV from: ${csvPath}`);
        const orders = await parseCSV(csvPath);
        console.log(`   - Loaded ${orders.length} orders.`);

        // 3. Create Routes
        const numDrivers = TEST_DRIVERS.length;
        const chunkSize = Math.ceil(orders.length / numDrivers);
        const routesData = [];

        console.log(`\n➗ 3. Splitting into ${numDrivers} routes (based on driver count):`);

        for (let i = 0; i < numDrivers; i++) {
            const chunk = orders.slice(i * chunkSize, (i + 1) * chunkSize);
            if (!chunk.length) continue;

            const route = {
                region: `Zone ${String.fromCharCode(65 + i)}`,
                orders: chunk,
                totalDistance: chunk.length * 2, // Mock 2km per stop
                numberOfStops: chunk.length,
                totalWeight: chunk.reduce((sum, o) => sum + (o.weight || 0), 0),
                turnCount: chunk.length * 2,
                eta: chunk.length * 10
            };

            // Calculate Score
            route.routeHardshipScore = scoreRoute(route);
            routesData.push(route);

            console.log(`   🔸 Route ${i + 1} (${route.region}):`);
            console.log(`      - Orders: ${route.numberOfStops}`);
            console.log(`      - Mode Score: +${route.modeScore}`);
            console.log(`      - Priority Score: +${route.priorityScore}`);
            console.log(`      - Final Hardship Score: ${route.routeHardshipScore.toFixed(2)}`);
        }

        // 4. Run Assignment Logic
        console.log("\n⚖️ 4. Running Fair Assignment Logic...");
        const assignments = assignRoutes([...TEST_DRIVERS], [...routesData]);

        console.log("\n✅ 5. Final Assignments:");
        assignments.forEach(({ driver, route }) => {
            console.log(`   👉 Route (${route.routeHardshipScore.toFixed(1)}) assigned to ${driver.name}`);
        });

        console.log("\n(Note: Hardest Route should go to Alice, then Bob, then Charlie)");

    } catch (err) {
        console.error(err);
    }
};

runTest();
