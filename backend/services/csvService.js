const csv = require("csv-parser");
const fs = require("fs");

module.exports = (filePath) =>
    new Promise((resolve) => {
        const orders = [];
        fs.createReadStream(filePath)
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim().replace(/^\ufeff/, '').toLowerCase()
            }))
            .on("data", (row) => {
                // Helper to find value from aliases
                const getVal = (aliases) => {
                    for (const alias of aliases) {
                        if (row[alias]) return row[alias];
                    }
                    return null;
                };

                const lat = parseFloat(getVal(['latitude', 'lat']));
                const lng = parseFloat(getVal(['longitude', 'lng', 'long']));

                if (orders.length === 0) console.log("CSV Row Headers detected:", Object.keys(row));

                const addressRaw = getVal(['address', 'delivery address', 'location']);
                if (!addressRaw) return; // Skip empty rows

                // Backend Geocoding Dictionary (Fallback)
                let finalCoords = (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null;

                if (!finalCoords && addressRaw) {
                    const addr = addressRaw.toLowerCase();
                    // Helper for random jitter to prevent overlap
                    const jitter = () => (Math.random() - 0.5) * 0.01;

                    if (addr.includes("sathy road")) finalCoords = { lat: 11.3500 + jitter(), lng: 77.7300 + jitter() };
                    else if (addr.includes("veerappan")) finalCoords = { lat: 11.3600 + jitter(), lng: 77.7200 + jitter() };
                    else if (addr.includes("surampatti")) finalCoords = { lat: 11.3344 + jitter(), lng: 77.7144 + jitter() };
                    else if (addr.includes("erode")) finalCoords = { lat: 11.3270 + jitter(), lng: 77.7100 + jitter() };
                    else if (addr.includes("bhavani")) finalCoords = { lat: 11.4456 + jitter(), lng: 77.6820 + jitter() };
                    else if (addr.includes("perundurai")) finalCoords = { lat: 11.2756 + jitter(), lng: 77.5831 + jitter() };
                    else if (addr.includes("chennimalai")) finalCoords = { lat: 11.1690 + jitter(), lng: 77.6080 + jitter() };
                }

                let oId = getVal(['orderid', 'order id', 'id', 'order no', 'no', 's.no', '#']);
                if (!oId) {
                    // Auto-generate if missing
                    oId = `GEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                }

                orders.push({
                    orderId: oId,
                    address: addressRaw,
                    coordinates: finalCoords,
                    weight: parseFloat(getVal(['weight']) || 0),
                    mode: (getVal(['mode']) || 'notmentioned').toLowerCase(),
                    priority: (getVal(['priority']) || 'normal').toLowerCase()
                });
            })
            .on("end", () => resolve(orders));
    });
