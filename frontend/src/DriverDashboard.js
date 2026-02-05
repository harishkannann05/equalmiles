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

    const drawRouteOnMap = React.useCallback(async (routeData) => {
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

            for (let index = 0; index < unvisited.length; index++) {
                const orderObj = unvisited[index];
                const stop = orderObj.actualCoordinates;
                const d = Math.sqrt(Math.pow(stop[0] - currentPos[0], 2) + Math.pow(stop[1] - currentPos[1], 2));
                if (d < minDist) {
                    minDist = d;
                    nearestIndex = index;
                }
            }

            if (nearestIndex !== -1) {
                const nextOrder = unvisited.splice(nearestIndex, 1)[0];
                sortedOrders.push(nextOrder);
                currentPos = nextOrder.actualCoordinates;
            }
        }

        const points = [office, ...sortedOrders.map(o => o.actualCoordinates)];

        // --- DRAW MARKERS & FIT BOUNDS FIRST (Instant Feedback) ---

        // 1. Draw Office
        L.marker([office[1], office[0]]).addTo(layerGroup).bindPopup("<b>🏁 Start Point (Office)</b>");

        // 2. Draw Stops
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

        // 3. Fit Bounds Immediately
        if (map && map.getContainer()) {
            try {
                const bounds = L.latLngBounds(points.map(p => [p[1], p[0]]));
                if (bounds.isValid()) {
                    map.fitBounds(bounds.pad(0.1));
                }
            } catch (err) {
                console.warn("Map fitBounds failed", err);
            }
        }

        // --- FETCH & DRAW ROUTE (Async Segments) ---
        // Iterate through segments to get actual road geometry
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];

            if (!start || !end || isNaN(start[0]) || isNaN(start[1]) || isNaN(end[0]) || isNaN(end[1])) continue;

            const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;

            let success = false;
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
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
                        success = true;
                    }
                }
            } catch (err) {
                console.error("OSRM Error:", err);
            }

            // Fallback: Dashed line if OSRM failed
            if (!success) {
                L.polyline([[start[1], start[0]], [end[1], end[0]]], {
                    color: '#007bff',
                    weight: 4,
                    opacity: 0.5,
                    dashArray: '10, 10'
                }).addTo(layerGroup);
            }

            // Delay to prevent Rate Limiting (429)
            await new Promise(r => setTimeout(r, 400));
        }
    }, []); // no deps needed

    const handleToggleStop = async (index, currentStatus) => {
        if (!route) return;

        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

        try {
            const res = await fetch(`/api/routes/${route._id}/stop-status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index, status: newStatus })
            });

            if (res.ok) {
                // Refresh data
                fetchData();
            }
        } catch (err) {
            console.error("Failed to toggle stop", err);
        }
    };

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
        // Check authentication
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");

        if (!token || role !== 'driver') {
            navigate('/driver/login');
            return;
        }

        fetchData();
    }, [fetchData, navigate]);

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

    if (loading) return <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading dashboard...</div>;
    if (!driver) return null;

    // Determining UI State
    let statusMessage = "";
    let statusColor = "var(--text-muted)";

    if (!driver.isActive) {
        statusMessage = "Your account is inactive. Contact admin.";
        statusColor = "var(--accent)";
    } else if (!driver.onDuty) {
        statusMessage = "You are currently OFF DUTY.";
        statusColor = "var(--accent)";
    } else if (driver.onDuty && !route) {
        statusMessage = "Waiting for route assignment...";
        statusColor = "var(--primary)";
    } else if (route) {
        statusMessage = route.status === "completed" ? "Route Completed" : "Route Assigned";
        statusColor = route.status === "completed" ? "var(--secondary)" : "var(--primary)";
    }

    return (
        <div className="container fade-in" style={{ padding: '1.5rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                            {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{driver.name}</h1>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>Driver Dashboard</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>STATUS</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: driver.onDuty ? 'var(--secondary)' : 'var(--accent)' }}>
                        {driver.onDuty ? '🟢 ON DUTY' : '🔴 OFF DUTY'}
                    </div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--secondary)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ROUTES COMPLETED</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{driver.totalRoutesCompleted}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>HARDSHIP SCORE</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{driver.averageHardshipScore.toFixed(1)}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--border)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>SYSTEM STATUS</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: systemStatus.dutyLocked ? 'var(--accent)' : 'var(--secondary)' }}>
                        {systemStatus.dutyLocked ? '🔒 Locked' : '✅ Open'}
                    </div>
                </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1.5rem' }}>
                {/* Left Column - Controls and Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Duty Control Card */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>⚡ Duty Control</h3>
                        <button
                            onClick={toggleDuty}
                            disabled={systemStatus.dutyLocked || !driver.isActive}
                            className={`btn ${driver.onDuty ? 'btn-outline' : 'btn-primary'}`}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                opacity: (systemStatus.dutyLocked || !driver.isActive) ? 0.6 : 1,
                                cursor: (systemStatus.dutyLocked || !driver.isActive) ? 'not-allowed' : 'pointer',
                                borderColor: driver.onDuty ? 'var(--accent)' : '',
                                color: driver.onDuty ? 'var(--accent)' : ''
                            }}
                        >
                            {driver.onDuty ? '🔴 Go Off Duty' : '🟢 Go On Duty'}
                        </button>
                        {systemStatus.dutyLocked && (
                            <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', color: 'var(--accent)', textAlign: 'center' }}>
                                🔒 Duty changes locked by admin
                            </p>
                        )}
                        {!driver.isActive && (
                            <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', color: 'var(--accent)', textAlign: 'center' }}>
                                ⚠️ Account inactive. Contact admin.
                            </p>
                        )}
                    </div>

                    {/* Status Card */}
                    <div className="card" style={{ padding: '1.5rem', background: 'white', border: `1px solid ${statusColor}` }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Status</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>{statusMessage}</p>
                        </div>
                        {driver.onDuty && (
                            <button
                                onClick={fetchData}
                                className="btn"
                                style={{
                                    marginTop: '1rem',
                                    width: '100%',
                                    fontSize: '0.9rem',
                                    background: 'white',
                                    border: `1px solid ${statusColor}`,
                                    color: 'var(--text-main)'
                                }}
                            >
                                🔄 Refresh Route
                            </button>
                        )}
                    </div>

                    {/* Route Stats (if route assigned) */}
                    {route && (
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--primary)' }}>📊 Route Stats</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Region</span>
                                    <span style={{ fontWeight: '600' }}>{route.region}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Stops</span>
                                    <span style={{ fontWeight: '600' }}>{route.numberOfStops}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Distance</span>
                                    <span style={{ fontWeight: '600' }}>{route.totalDistance.toFixed(1)} km</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>ETA</span>
                                    <span style={{ fontWeight: '600' }}>{route.eta.toFixed(0)} mins</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Difficulty</span>
                                    <span style={{ fontWeight: '600' }}>{route.routeHardshipScore.toFixed(0)}</span>
                                </div>
                                <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: route.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 155, 81, 0.2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <span style={{ fontWeight: '600', color: route.status === 'completed' ? 'var(--secondary)' : 'var(--primary)' }}>
                                        {route.status === 'completed' ? '✅ COMPLETED' : '🚚 IN PROGRESS'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Map and Delivery List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {route ? (
                        <>
                            {/* Map Container */}
                            <div className="card" style={{ padding: 0, overflow: 'hidden', height: '500px' }}>
                                <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '500px' }}></div>
                            </div>

                            {/* Delivery Stops List */}
                            <div className="card" style={{ padding: '1.5rem', maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>🛑 Delivery Stops ({route.numberOfStops})</h3>
                                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {route.orders.map((order, i) => {
                                            const address = typeof order === 'string' ? order : (order.address || "Unknown Address");
                                            const mode = typeof order === 'object' ? order.mode : "N/A";
                                            const priority = typeof order === 'object' ? order.priority : "Normal";
                                            // Removed unused 'weight' variable here
                                            const isCompleted = order.status === 'completed';

                                            return (
                                                <div
                                                    key={i}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '1rem',
                                                        padding: '1rem',
                                                        background: isCompleted ? '#f0fdf4' : 'white',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: isCompleted ? '1px solid #bbf7d0' : '1px solid var(--border-light)',
                                                        transition: 'var(--transition)',
                                                        opacity: isCompleted ? 0.8 : 1
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        background: isCompleted ? '#10b981' : '#E2A16F',
                                                        color: 'white',
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.9rem',
                                                        flexShrink: 0,
                                                        marginTop: '2px'
                                                    }}>
                                                        {isCompleted ? '✓' : i + 1}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{
                                                            fontWeight: '600',
                                                            fontSize: '0.95rem',
                                                            marginBottom: '0.5rem',
                                                            color: isCompleted ? '#15803d' : 'var(--text-main)',
                                                            textDecoration: isCompleted ? 'line-through' : 'none'
                                                        }}>
                                                            {address}
                                                        </div>
                                                        {typeof order === 'object' && (
                                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: '#f5f5f5', color: '#666' }}>📦 {mode}</span>
                                                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: priority === 'High' ? '#fee2e2' : '#dcfce7', color: priority === 'High' ? '#ef4444' : '#16a34a', fontWeight: 'bold' }}>{priority}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggleStop(i, order.status)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            border: isCompleted ? '1px solid #10b981' : 'none',
                                                            background: isCompleted ? 'white' : '#10b981',
                                                            color: isCompleted ? '#10b981' : 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '600',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {isCompleted ? 'Undo' : 'Done'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }}>🗺️</div>
                            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>No Active Route</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                {driver.onDuty ? 'Waiting for route assignment from admin...' : 'Go on duty to receive route assignments'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DriverDashboard;
