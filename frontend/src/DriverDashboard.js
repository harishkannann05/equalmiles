import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default icon issues in React/Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const office = [77.710, 11.327];

const getCoordinates = (order) => {
    if (order.coordinates && order.coordinates.lat && order.coordinates.lng) {
        return [order.coordinates.lng, order.coordinates.lat];
    }
    const rawAddress = order.address || "";
    if (!rawAddress) return null;
    const address = rawAddress.toLowerCase();

    if (address.includes("surampatti")) return [77.7144, 11.3344];
    if (address.includes("erode")) return [77.710, 11.327];
    if (address.includes("bhavani")) return [77.6820, 11.4456];
    if (address.includes("perundurai")) return [77.5831, 11.2756];
    if (address.includes("chennimalai")) return [77.6080, 11.1690];

    // Fallback for demo
    return [77.710 + (Math.random() - 0.5) * 0.01, 11.327 + (Math.random() - 0.5) * 0.01];
};

const DriverDashboard = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [driver, setDriver] = useState(null);
    const [route, setRoute] = useState(null);
    const [systemStatus, setSystemStatus] = useState({ dutyLocked: false });
    const [loading, setLoading] = useState(true);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);

    // Layer group ref to manage clean updates
    const layerGroupRef = useRef(null);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const drawRouteOnMap = React.useCallback((routeData) => {
        if (!mapInstanceRef.current || !routeData) return;
        const map = mapInstanceRef.current;

        // Initialize layer group if not exists
        if (!layerGroupRef.current) {
            layerGroupRef.current = L.layerGroup().addTo(map);
        }
        const layerGroup = layerGroupRef.current;
        layerGroup.clearLayers();

        // 1. Prepare Data with Metadata
        const rawOrders = routeData.orders.map((o, index) => ({
            ...o,
            actualCoordinates: getCoordinates(o),
            originalIndex: index
        })).filter(o => o.actualCoordinates);

        if (rawOrders.length === 0) return;

        // --- Nearest Neighbor Algorithm (Client-Side TSP) ---
        // Sort the entire Order objects, not just coordinates

        const sortedOrders = [];
        let currentPos = office;
        const unvisited = [...rawOrders];

        while (unvisited.length > 0) {
            let nearestIndex = -1;
            let minDist = Infinity;

            unvisited.forEach((orderObj, index) => {
                const stop = orderObj.actualCoordinates;
                const d = Math.sqrt(Math.pow(stop[0] - currentPos[0], 2) + Math.pow(stop[1] - currentPos[1], 2));
                if (d < minDist) {
                    minDist = d;
                    nearestIndex = index;
                }
            });

            if (nearestIndex !== -1) {
                const nextOrder = unvisited.splice(nearestIndex, 1)[0];
                sortedOrders.push(nextOrder);
                currentPos = nextOrder.actualCoordinates;
            }
        }

        const points = [office, ...sortedOrders.map(o => o.actualCoordinates)];

        // 1. Draw Path: OSRM Road Network
        // Iterate through segments to get actual road geometry
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];

            const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (data.routes && data.routes.length > 0) {
                        const route = data.routes[0];
                        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

                        // Draw ROAD path (Solid Blue)
                        L.polyline(coords, {
                            color: '#007bff',
                            weight: 6,
                            opacity: 0.8,
                            lineJoin: 'round'
                        }).addTo(layerGroup);
                    } else {
                        console.warn("OSRM returned no route for segment.");
                    }
                })
                .catch(err => {
                    console.error("OSRM Error:", err);
                });
        }

        // 2. Draw Office
        L.marker([office[1], office[0]]).addTo(layerGroup).bindPopup("<b>🏁 Start Point (Office)</b>");

        // 3. Draw Stops (in Optimized Order)
        sortedOrders.forEach((orderObj, i) => {
            const s = orderObj.actualCoordinates;

            L.circleMarker([s[1], s[0]], {
                color: 'white',
                fillColor: 'blue',
                fillOpacity: 1,
                radius: 8,
                weight: 2
            }).addTo(layerGroup).bindPopup(`<b>Stop #${i + 1}</b><br>${orderObj.address}`);
        });

        // Fit bounds
        const bounds = L.latLngBounds(points.map(p => [p[1], p[0]]));
        map.fitBounds(bounds.pad(0.1));
    }, []); // no deps needed

    const fetchData = React.useCallback(async () => {
        try {
            // 1. Fetch Driver Details
            const driverRes = await fetch(`/api/drivers/${id}`);
            if (!driverRes.ok) {
                alert("Driver not found/inactive");
                navigate("/");
                return;
            }
            const driverData = await driverRes.json();
            setDriver(driverData);

            // 2. Fetch System Status
            const systemRes = await fetch('/api/system/status');
            const systemData = await systemRes.json();
            setSystemStatus(systemData);

            // 3. Fetch Assigned Route
            const routeRes = await fetch(`/api/routes/driver/${id}`);
            if (routeRes.ok) {
                const routeData = await routeRes.json();
                setRoute(routeData);
            } else {
                setRoute(null);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Init Map - Run ONCE when route container is likely ready (after loading)
    useEffect(() => {
        if (loading || !mapRef.current) return;
        if (mapInstanceRef.current) return; // Prevent double init

        const map = L.map(mapRef.current).setView([11.327, 77.710], 12);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Init layer group
        layerGroupRef.current = L.layerGroup().addTo(map);

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            layerGroupRef.current = null;
        };
    }, [loading]);

    // React to Route Changes
    useEffect(() => {
        if (!loading && route && mapInstanceRef.current) {
            drawRouteOnMap(route);
        }
    }, [route, loading, drawRouteOnMap]);


    const toggleDuty = async () => {
        if (systemStatus.dutyLocked) return;

        try {
            const res = await fetch(`/api/drivers/${id}/duty`, { method: 'PATCH' });
            const updated = await res.json();
            setDriver(prev => ({ ...prev, onDuty: updated.onDuty }));
        } catch (err) {
            alert("Failed to update duty status");
        }
    };

    if (loading) return <div>Loading dashboard...</div>;
    if (!driver) return null;

    // Determining UI State
    let statusMessage = "";
    let statusColor = "#666";

    if (!driver.isActive) {
        statusMessage = "Your account is inactive. Contact admin.";
        statusColor = "red";
    } else if (!driver.onDuty) {
        statusMessage = "You are off duty today.";
        statusColor = "#dc3545";
    } else if (driver.onDuty && !route) {
        statusMessage = "Waiting for route assignment...";
        statusColor = "#17a2b8";
    } else if (route) {
        statusMessage = route.status === "completed" ? "Route Completed" : "Route Assigned";
        statusColor = route.status === "completed" ? "#28a745" : "#007bff";
    }

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '800px', margin: '0 auto' }}>
            {/* Header with System Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h1>{driver.name}'s Dashboard</h1>
                    <button onClick={handleLogout} style={{ padding: '5px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8em' }}>Logout</button>
                </div>
                <div style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    background: systemStatus.dutyLocked ? '#e2e3e5' : '#d4edda',
                    color: systemStatus.dutyLocked ? '#383d41' : '#155724',
                    fontSize: '0.9em',
                    fontWeight: 'bold'
                }}>
                    {systemStatus.dutyLocked ? "🔒 Duty Locked by Admin" : "🔓 Duty Open"}
                </div>
            </div>

            {/* Driver Controls */}
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <strong>Availability: </strong>
                        <span style={{ color: driver.onDuty ? 'green' : 'red', fontWeight: 'bold' }}>
                            {driver.onDuty ? "ON DUTY" : "OFF DUTY"}
                        </span>
                    </div>

                    <button
                        onClick={toggleDuty}
                        disabled={systemStatus.dutyLocked || !driver.isActive}
                        style={{
                            padding: '10px 20px',
                            background: driver.onDuty ? '#dc3545' : '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: (systemStatus.dutyLocked || !driver.isActive) ? 'not-allowed' : 'pointer',
                            opacity: (systemStatus.dutyLocked || !driver.isActive) ? 0.6 : 1
                        }}
                    >
                        {driver.onDuty ? "Go Off Duty" : "Go On Duty"}
                    </button>
                </div>
                {systemStatus.dutyLocked && <p style={{ color: '#666', fontSize: '0.85em', marginTop: '10px' }}>Duty status cannot be changed while locked.</p>}
            </div>

            {/* Main Status Area */}
            <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed #ccc', borderRadius: '8px', marginBottom: '20px' }}>
                <h2 style={{ color: statusColor }}>{statusMessage}</h2>
                {driver.onDuty && (
                    <button
                        onClick={fetchData}
                        style={{ marginTop: '10px', background: 'transparent', border: '1px solid #007bff', color: '#007bff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        🔄 Refresh Route
                    </button>
                )}
            </div>

            {/* Route Details (if assigned) */}
            {route && (
                <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: '#007bff', color: 'white', padding: '10px 15px' }}>
                        <h3>📍 Assigned Route: {route.region}</h3>
                    </div>

                    {/* DRIVER MAP */}
                    <div style={{ height: '400px', width: '100%', borderBottom: '1px solid #ddd' }}>
                        <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
                    </div>

                    <div style={{ padding: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div><strong>Status:</strong> {route.status.toUpperCase()}</div>
                            <div><strong>Stops:</strong> {route.numberOfStops}</div>
                            <div><strong>Total Distance:</strong> {route.totalDistance.toFixed(1)} km</div>
                            <div><strong>ETA:</strong> {route.eta.toFixed(0)} mins</div>
                            <div><strong>Difficulty Score:</strong> {route.routeHardshipScore.toFixed(0)}</div>
                            <div><strong>Turns:</strong> {route.turnCount}</div>
                        </div>

                        <h4 style={{ marginTop: '20px' }}>🛑 Stops:</h4>
                        <ul style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {route.orders.map((order, i) => {
                                const address = typeof order === 'string' ? order : (order.address || "Unknown Address");
                                const mode = typeof order === 'object' ? order.mode : "N/A";
                                const priority = typeof order === 'object' ? order.priority : "Normal";

                                return (
                                    <li key={i} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee', listStyle: 'none' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.05em' }}>
                                            <span style={{ color: '#007bff', marginRight: '8px' }}>#{i + 1}</span>
                                            {address}
                                        </div>
                                        {typeof order === 'object' && (
                                            <div style={{ fontSize: '0.85em', color: '#555', marginTop: '4px', marginLeft: '30px', display: 'flex', gap: '15px' }}>
                                                <span style={{ background: '#f8f9fa', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                                                    📦 Mod: <b>{mode}</b>
                                                </span>
                                                <span style={{ background: '#fff3cd', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ffeeba', color: '#856404' }}>
                                                    🚨 Prio: <b>{priority}</b>
                                                </span>
                                                <span>
                                                    ⚖️ Wgt: {order.weight || 0}kg
                                                </span>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}

            {/* Stats Footer */}
            <div style={{ marginTop: '40px', fontSize: '0.9em', color: '#666', textAlign: 'center' }}>
                <p>Total Routes Completed: {driver.totalRoutesCompleted} | My Hardship Score: {driver.averageHardshipScore.toFixed(1)}</p>
            </div>

        </div>
    );
};

export default DriverDashboard;
