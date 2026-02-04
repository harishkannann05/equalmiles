const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const Driver = require("./models/Driver");

dotenv.config();

const sampleDrivers = [
    {
        name: "Harish",
        email: "harish90950@gmail.com",
        passwordHash: "$2b$10$v028v1gy.xQUPjfsasBKKeZVNNggA36BWFVBI1gHiYAAD4SHrjdOy", // 1234
        onDuty: true,
        isActive: true,
        isApproved: true,
        averageHardshipScore: 0,
        totalRoutesCompleted: 0
    },
    {
        name: "John Doe",
        email: "john@example.com",
        passwordHash: "$2b$10$v028v1gy.xQUPjfsasBKKeZVNNggA36BWFVBI1gHiYAAD4SHrjdOy",
        onDuty: true,
        isActive: true,
        isApproved: true,
        averageHardshipScore: 2.5,
        totalRoutesCompleted: 5
    },
    {
        name: "Jane Smith",
        email: "jane@example.com",
        passwordHash: "$2b$10$v028v1gy.xQUPjfsasBKKeZVNNggA36BWFVBI1gHiYAAD4SHrjdOy",
        onDuty: false,
        isActive: true,
        isApproved: true,
        averageHardshipScore: 4.1,
        totalRoutesCompleted: 12
    },
    {
        name: "Mike Johnson",
        email: "mike@example.com",
        passwordHash: "$2b$10$v028v1gy.xQUPjfsasBKKeZVNNggA36BWFVBI1gHiYAAD4SHrjdOy",
        onDuty: true,
        isActive: true,
        isApproved: true,
        averageHardshipScore: 1.2,
        totalRoutesCompleted: 3
    },
    {
        name: "Sarah Williams",
        email: "sarah@example.com",
        passwordHash: "$2b$10$v028v1gy.xQUPjfsasBKKeZVNNggA36BWFVBI1gHiYAAD4SHrjdOy",
        onDuty: false,
        isActive: true,
        isApproved: true,
        averageHardshipScore: 3.8,
        totalRoutesCompleted: 8
    },
    {
        name: "Robert Brown",
        email: "robert@example.com",
        passwordHash: "$2b$10$v028v1gy.xQUPjfsasBKKeZVNNggA36BWFVBI1gHiYAAD4SHrjdOy",
        onDuty: false,
        isActive: true,
        isApproved: true,
        averageHardshipScore: 0,
        totalRoutesCompleted: 0
    }
];

const seedDrivers = async () => {
    try {
        await connectDB();
        console.log("MongoDB Connected for Seeding...");

        // Optional: Clear existing drivers? The user said "add", usually safe to Append, but duplicates might be annoying.
        // I check if they exist by email to avoid duplicates.

        for (const d of sampleDrivers) {
            const exists = await Driver.findOne({ email: d.email });
            if (!exists) {
                await Driver.create(d);
                console.log(`Added: ${d.name}`);
            } else {
                console.log(`Skipped (Exists): ${d.name}`);
            }
        }

        console.log("Seeding Complete!");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedDrivers();
