const parseCSV = require("./services/csvService");

console.log("Testing CSV Parser...");
parseCSV("./test_orders.csv").then(orders => {
    console.log(`Parsed ${orders.length} orders.`);
    if (orders.length > 0) {
        console.log("First Order:", JSON.stringify(orders[0], null, 2));
    } else {
        console.log("No orders parsed.");
    }
}).catch(err => console.error("Error:", err));
