module.exports = (drivers, routes) => {
    // 1. Sort Drivers by Fairness Score (Lowest Score = Least Burdened)
    // Fairness Score = AverageHardship * log(TotalRoutes + 1)
    // This ensures new drivers (low total) get work, but experienced drivers aren't punished.

    // Sort Drivers: Lowest Fairness Score First
    drivers.sort((a, b) => {
        const scoreA = (a.averageHardshipScore || 0) * Math.log((a.totalRoutesCompleted || 0) + 1);
        const scoreB = (b.averageHardshipScore || 0) * Math.log((b.totalRoutesCompleted || 0) + 1);
        return scoreA - scoreB;
    });

    // 2. Sort Routes by Hardness (Hardest First)
    routes.sort((a, b) => b.routeHardshipScore - a.routeHardshipScore);

    // 3. Assign: Hardest Route -> Least Burdened Driver
    return routes.map((route, i) => {
        // If more routes than drivers, loop back to the start (round robin style for excess)
        const driver = drivers[i % drivers.length];
        return { route, driver };
    });
};
