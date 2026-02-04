module.exports = (route) => {
    let modeScore = 0;
    let priorityScore = 0;

    // Calculate Mode & Priority Scores from Orders
    if (route.orders && route.orders.length > 0) {
        route.orders.forEach(order => {
            // Mode Scoring
            const mode = order.mode || 'notMentioned';
            if (mode === 'apartment') modeScore += 5;
            else if (mode === 'office') modeScore += 3;
            else if (mode === 'house') modeScore += 2;
            else modeScore += 3; // default/notMentioned

            // Priority Scoring
            const priority = order.priority || 'normal';
            if (priority === 'urgent') priorityScore += 10;
            else if (priority === 'high') priorityScore += 5;
            else priorityScore += 0; // normal
        });
    }

    // Store sub-scores for breakdown (if route is a mongoose doc, this works if we save it later)
    route.modeScore = modeScore;
    route.priorityScore = priorityScore;

    // Final Formula
    // routeHardshipScore = (dist*2) + (stops*5) + (weight*1.5) + modeScore + priorityScore + turns + (eta*0.5)
    return (
        (route.totalDistance || 0) * 2 +
        (route.numberOfStops || 0) * 5 +
        (route.totalWeight || 0) * 1.5 +
        modeScore +
        priorityScore +
        (route.turnCount || 0) * 1 +
        (route.eta || 0) * 0.5
    );
};
