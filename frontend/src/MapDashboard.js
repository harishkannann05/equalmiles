import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';

// Fix for default icon issues in React/Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const office = [77.710, 11.327];

const MapDashboard = () => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const navigate = useNavigate();

    // Pending Drivers State
    // Pending & Active Drivers State
    // Driver States
    const [drivers, setDrivers] = useState([]);
    const [pendingDrivers, setPendingDrivers] = useState([]);
    const [onDutyDrivers, setOnDutyDrivers] = useState([]);
    const [offDutyDrivers, setOffDutyDrivers] = useState([]);

    // Modal State
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [driverRoute, setDriverRoute] = useState(null);
    const [assignmentHtml, setAssignmentHtml] = useState(null);
    const [routesList, setRoutesList] = useState([]);
    const [processing, setProcessing] = useState(false);

    // System State
    const [dutyLocked, setDutyLocked] = useState(false);

    const fetchPendingDrivers = async () => {
        try {
            const res = await fetch("/api/admin/pending-drivers");
            const data = await res.json();
            setPendingDrivers(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchApprovedDrivers = async () => {
        try {
            const res = await fetch("/api/admin/approved-drivers");
            const data = await res.json();
            setDrivers(data); // Store all approved drivers
            setOnDutyDrivers(data.filter(d => d.onDuty));
            setOffDutyDrivers(data.filter(d => !d.onDuty));
        } catch (err) {
            console.error(err);
        }
    };

    // Handle Driver Click
    const handleDriverClick = async (driver) => {
        setSelectedDriver(driver);
        setDriverRoute(null); // Reset
        try {
            const res = await fetch(`/api/routes/driver/${driver._id}`);
            if (res.ok) {
                const data = await res.json();
                setDriverRoute(data || null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const closeModal = () => {
        setSelectedDriver(null);
        setDriverRoute(null);
    };

    const fetchSystemStatus = async () => {
        try {
            const res = await fetch("/api/admin/system/status");
            const data = await res.json();
            setDutyLocked(data.dutyLocked);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleDutyLock = async () => {
        try {
            const res = await fetch("/api/admin/system/duty-lock", { method: "POST" });
            const data = await res.json();
            setDutyLocked(data.dutyLocked);
            alert(`Duty is now ${data.dutyLocked ? "LOCKED 🔒" : "UNLOCKED 🔓"}`);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteDriver = async () => {
        if (!selectedDriver) return;
        if (!window.confirm(`Are you sure you want to remove ${selectedDriver.name}?`)) return;

        try {
            await fetch(`/api/admin/driver/${selectedDriver._id}`, { method: "DELETE" });
            alert("Driver removed successfully");
            closeModal();
            fetchPendingDrivers();
            fetchApprovedDrivers();
        } catch (err) {
            console.error(err);
            alert("Failed to delete driver");
        }
    };

    // Data fetching and Effect moved to bottom to resolve hoisting issues

    // ================= HELPER CONSTANTS & FUNCTIONS =================

    const getCoordinates = (order) => {
        // 1. Try DB Coordinates
        if (order.coordinates && order.coordinates.lat && order.coordinates.lng) {
            return [order.coordinates.lng, order.coordinates.lat];
        }

        // 2. Fallback to Address
        const rawAddress = order.address;
        if (!rawAddress) {
            return null;
        }
        const address = rawAddress.toLowerCase();

        if (address.includes("surampatti")) return [77.7144, 11.3344];
        if (address.includes("erode")) return [77.710, 11.327];
        if (address.includes("bhavani")) return [77.6820, 11.4456];
        if (address.includes("perundurai")) return [77.5831, 11.2756];
        if (address.includes("chennimalai")) return [77.6080, 11.1690];

        // Fallback for demo
        return [77.710 + (Math.random() - 0.5) * 0.01, 11.327 + (Math.random() - 0.5) * 0.01];
    };

    const drawMultiStopRoute = React.useCallback(async (driver) => {
        if (!mapInstanceRef.current) return;

        // --- 1. Nearest Neighbor Optimization (Start from Office) ---
        const rawStops = [...driver.stops];
        const sortedStops = [];
        let currentPos = office;

        while (rawStops.length > 0) {
            let nearestIndex = -1;
            let minDist = Infinity;

            for (let index = 0; index < rawStops.length; index++) {
                const stop = rawStops[index];
                const d = Math.sqrt(Math.pow(stop[0] - currentPos[0], 2) + Math.pow(stop[1] - currentPos[1], 2));
                if (d < minDist) {
                    minDist = d;
                    nearestIndex = index;
                }
            }

            if (nearestIndex !== -1) {
                const nextStop = rawStops.splice(nearestIndex, 1)[0];
                sortedStops.push(nextStop);
                currentPos = nextStop;
            }
        }

        const points = [office, ...sortedStops];

        // --- 2. Draw OSRM Road Paths (Sequentially) ---
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];

            const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;

            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data.routes && data.routes.length > 0) {
                        const route = data.routes[0];
                        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                        if (mapInstanceRef.current) {
                            L.polyline(coords, { color: driver.color, weight: 6, opacity: 0.9 }).addTo(mapInstanceRef.current);
                        }
                    }
                }
            } catch (err) {
                console.error("Routing Error", err);
            }

            // Pause between segments to avoid 429 (OSRM Public API limit)
            await new Promise(r => setTimeout(r, 800));
        }

        // --- 3. Draw Markers (Sorted Order) ---
        sortedStops.forEach((s, i) => {
            const isLast = i === sortedStops.length - 1;

            if (mapInstanceRef.current && isLast) {
                // Final Destination Marker Only
                L.circleMarker([s[1], s[0]], {
                    color: 'black',
                    fillColor: driver.color,
                    fillOpacity: 1,
                    radius: 12,
                    weight: 3
                }).addTo(mapInstanceRef.current)
                    .bindPopup(`<b>🛑 Final Destination</b><br>${driver.name}`);
            }
        });
    }, []);

    const visualizeRoutes = React.useCallback(async (routes) => {
        if (!mapInstanceRef.current) return;

        // Extended Palette
        const colors = [
            "#6366f1", "#ef4444", "#10b981", "#8b5cf6", "#f97316", "#ec4899", "#06b6d4", "#7c3aed", "#14b8a6", "#64748b"
        ];

        // Process sequentially to avoid OSRM Rate Limiting (429)
        for (let i = 0; i < routes.length; i++) {
            const route = routes[i];
            if (!route.orders || route.orders.length === 0) continue;

            const stops = route.orders.map(o => getCoordinates(o)).filter(Boolean);
            if (stops.length === 0) continue;

            const driverMock = {
                name: `Route ${route.region}`,
                color: colors[i % colors.length],
                stops: stops
            };

            await drawMultiStopRoute(driverMock);
            await new Promise(r => setTimeout(r, 500));
        }
    }, [drawMultiStopRoute]);

    // --- Reactive HTML Generation for Results ---
    useEffect(() => {
        if (!routesList || routesList.length === 0) {
            setAssignmentHtml(null);
            return;
        }

        let html = "<h3 style='margin-top:0; color: var(--color-primary); font-size: 1.2rem; display: flex; alignItems: center; gap: 0.5rem;'>✅ Assignment Complete</h3>";
        html += "<div style='display: flex; flex-direction: column; gap: 10px;'>";

        // Sort routes by score (Hardest first)
        const sortedRoutes = [...routesList].sort((a, b) => b.routeHardshipScore - a.routeHardshipScore);

        console.log("DEBUG: Drivers List:", drivers);

        sortedRoutes.forEach((route, i) => {
            let driverId = route.assignedDriverId;
            let foundName = null;

            // Handle if assignedDriverId is actually a populated object (has name/email)
            if (typeof driverId === 'object' && driverId !== null) {
                if (driverId.name) foundName = driverId.name; // It was fully populated!
                if (driverId._id) driverId = driverId._id;   // Extract ID if nested
            }

            // Ensure ID is a string for comparison
            const lookupId = String(driverId);

            // If we didn't find the name from the object itself, look it up
            let matchedDriver = null;
            if (typeof driverId === 'object' && driverId !== null && driverId.name) {
                matchedDriver = driverId;
            }
            if (!matchedDriver) {
                matchedDriver = drivers.find(d => String(d._id) === lookupId);
            }

            const driverName = matchedDriver ? matchedDriver.name : foundName || `Unknown (ID: ${lookupId})`;
            // Zone comes from the ROUTE, not the driver
            const driverZone = route.region || "N/A";

            // Palette match
            const colors = ["#E2A16F", "#86B0BD", "#D18F5A", "#6A9AA8", "#7BA888", "#D17A6F"];
            const color = colors[i % colors.length];

            html += `
                <div style="border-left: 4px solid ${color}; background: var(--bg-input); padding: 12px; border-radius: 8px; border: 1px solid var(--border-light); box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <h4 style="margin: 0; color: var(--text-main); font-size: 1rem;">${driverName}</h4>
                        <span style="background: ${color}20; color: ${color}; padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 0.75rem; border: 1px solid ${color}40;">Score: ${route.routeHardshipScore?.toFixed(1)}</span>
                    </div>
                    <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: center; gap: 5px;">
                        📦 ${route.orders.length} Stops <span style="color: var(--border);">•</span> 🛣️ ${route.totalDistance} km <span style="color: var(--border);">•</span> 📍 ${driverZone}
                    </p>
                    <details style="margin-top: 5px;">
                        <summary style="cursor: pointer; color: var(--color-primary); font-weight: 600; font-size: 0.85rem; user-select: none; padding: 4px 0;">View Stops</summary>
                        <ul style="padding-left: 0; margin: 10px 0 0 0; list-style: none; display: flex; flex-direction: column; gap: 8px;">
                            ${route.orders.map((o, idx) => {
                const addr = o.address ? o.address.split(',')[0] : "Unknown Address";
                return `
                                <li style="border: 1px solid var(--border-light); border-radius: 8px; padding: 12px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                                    <div style="display: flex; gap: 12px; align-items: start;">
                                        <div style="
                                            background: #E2A16F; color: white; width: 24px; height: 24px; 
                                            border-radius: 50%; display: flex; align-items: center; justify-content: center; 
                                            font-size: 0.85rem; font-weight: bold; flex-shrink: 0; margin-top: 2px;">
                                            ${idx + 1}
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="font-weight: 600; margin-bottom: 4px; color: var(--text-main); font-size: 0.9rem;">${addr}</div>
                                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                                <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: #f5f5f5; color: #666; border: 1px solid #eee;">📦 ${o.mode || 'N/A'}</span>
                                                <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${o.priority === 'High' ? '#fee2e2' : '#dcfce7'}; color: ${o.priority === 'High' ? '#ef4444' : '#16a34a'}; border: 1px solid ${o.priority === 'High' ? '#fecaca' : '#bbf7d0'}; font-weight: 600;">${o.priority || 'Normal'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            `;
            }).join('')}
                        </ul>
                    </details>
                </div>
            `;
        });
        html += "</div>";
        setAssignmentHtml(html);
    }, [routesList, drivers]);

    const processCSV = async () => {
        if (!dutyLocked) {
            alert("⚠️ Usage Error: You must LOCK DUTY before assigning routes to ensure the driver list is finalized.");
            return;
        }

        const fileInput = document.getElementById("csvFile");
        const file = fileInput?.files[0];
        if (!file) return alert("Please select a CSV file first.");

        setProcessing(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/admin/upload-csv", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Success! Generated and assigned ${data.routes.length} routes.`);

                // Update State to Trigger UI and Map
                setRoutesList(data.routes);

                // Visualize on Map immediately
                if (mapInstanceRef.current) {
                    visualizeRoutes(data.routes);
                }

                fetchData();
            } else {
                const err = await res.json();
                alert("Error: " + (err.message || "Failed to process CSV"));
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload file: " + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await fetch(`/api/admin/approve-driver/${id}`, { method: 'PATCH' });
            if (res.ok) {
                alert("Driver Approved!");
                fetchPendingDrivers();
            } else {
                alert("Failed to approve");
            }
        } catch (err) {
            alert("Approval failed");
        }
    };


    const fetchData = React.useCallback(async () => {
        // Refresh Pending/Approved drivers
        fetchPendingDrivers();
        fetchApprovedDrivers();

        // Refresh Routes
        try {
            const res = await fetch("/api/admin/routes");
            const routes = await res.json();
            setRoutesList(routes || []);

            if (routes && routes.length > 0) {
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.eachLayer((layer) => {
                        if (!layer._url) { // Don't remove tile layer
                            mapInstanceRef.current.removeLayer(layer);
                        }
                    });
                    // Re-add Office
                    L.marker([office[1], office[0]]).addTo(mapInstanceRef.current).bindPopup("<b>🏁 Start Point</b>");
                }
                visualizeRoutes(routes);
            }
        } catch (err) {
            console.error(err);
        }
    }, [visualizeRoutes]);

    useEffect(() => {
        // Auth Check
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");
        if (!token || role !== 'admin') {
            navigate('/admin/login');
            return;
        }

        fetchData();
        fetchSystemStatus();

        if (mapInstanceRef.current) return;

        // ================= MAP SETUP =================
        const map = L.map(mapRef.current).setView([11.327, 77.710], 11);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        const officeMarker = [11.327, 77.710];
        L.marker(officeMarker).addTo(map).bindPopup("<b>🏁 Start Point (Center)</b><br>Office – 11/1 Thiru Vee Ka St, Erode");

        return () => { };
    }, [navigate, fetchData]);


    return (
        <div className="container fade-in" style={{ padding: '1.5rem' }}>
            {/* Header with Stats */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ margin: 0, marginBottom: '0.5rem' }}>Admin Dashboard</h1>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Fleet Management & Route Optimization</p>
            </div>

            {/* Statistics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>TOTAL DRIVERS</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{drivers.length}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--secondary)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ON DUTY</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--secondary)' }}>{onDutyDrivers.length}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>PENDING</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{pendingDrivers.length}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--text-muted)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>OFF DUTY</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>{offDutyDrivers.length}</div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                {/* Left Column - Controls and Driver Lists */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* CSV Upload Section */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📦 Route Assignment</h3>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                type="file"
                                id="csvFile"
                                accept=".csv"
                                style={{
                                    flex: 1,
                                    minWidth: '250px',
                                    color: 'var(--text-main)',
                                    background: 'var(--bg-input)',
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)'
                                }}
                            />
                            <button onClick={processCSV} className="btn btn-primary">
                                Process Orders
                            </button>
                            <button
                                onClick={async () => {
                                    if (window.confirm("Reset all routes? This will delete current assignments.")) {
                                        try {
                                            const res = await fetch("/api/admin/reset-routes", { method: "DELETE" });
                                            const data = await res.json();
                                            alert(data.message);
                                            window.location.reload();
                                        } catch (err) {
                                            alert("Failed to reset routes");
                                        }
                                    }
                                }}
                                className="btn btn-outline"
                                style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                            >
                                Reset All
                            </button>
                        </div>
                    </div>

                    {/* Map Controls */}
                    <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '1rem' }}>
                        <button onClick={fetchData} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🔄 Refresh Map
                        </button>
                        <button
                            onClick={toggleDutyLock}
                            className={`btn ${dutyLocked ? 'btn-secondary' : 'btn-outline'}`}
                            style={dutyLocked ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
                        >
                            {dutyLocked ? "Unlock Duty 🔓" : "Lock Duty 🔒"}
                        </button>
                    </div>

                    {/* Pending Approvals */}
                    {pendingDrivers.length > 0 && (
                        <div className="card" style={{ padding: '1rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                ⏳ Pending Approvals
                                <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                                    {pendingDrivers.length}
                                </span>
                            </h3>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {pendingDrivers.map(d => (
                                    <div
                                        key={d._id}
                                        onClick={() => handleDriverClick(d)}
                                        style={{
                                            padding: '0.75rem',
                                            background: 'rgba(255, 155, 81, 0.1)',
                                            marginBottom: '0.5rem',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(255, 155, 81, 0.2)',
                                            transition: 'var(--transition)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 155, 81, 0.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 155, 81, 0.1)'}
                                    >
                                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{d.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.email}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* On-Duty Drivers */}
                    <div className="card" style={{ padding: '1rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🟢 Active Drivers
                            <span style={{ marginLeft: 'auto', background: 'var(--secondary)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                                {onDutyDrivers.length}
                            </span>
                        </h3>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {onDutyDrivers.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No active drivers</p>
                            ) : (
                                onDutyDrivers.map(d => (
                                    <div
                                        key={d._id}
                                        onClick={() => handleDriverClick(d)}
                                        style={{
                                            padding: '0.75rem',
                                            background: 'rgba(16, 185, 129, 0.05)',
                                            marginBottom: '0.5rem',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(16, 185, 129, 0.1)',
                                            transition: 'var(--transition)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'}
                                    >
                                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{d.name}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Off-Duty Drivers - Collapsible */}
                    <div className="card" style={{ padding: '1rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🔴 Off-Duty
                            <span style={{ marginLeft: 'auto', background: 'var(--border)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                                {offDutyDrivers.length}
                            </span>
                        </h3>
                        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            {offDutyDrivers.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>All drivers active</p>
                            ) : (
                                offDutyDrivers.map(d => (
                                    <div
                                        key={d._id}
                                        onClick={() => handleDriverClick(d)}
                                        style={{
                                            padding: '0.5rem',
                                            marginBottom: '0.5rem',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            color: 'var(--text-muted)',
                                            transition: 'var(--transition)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {d.name}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Map and Results */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Map Container - LARGER */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden', height: '600px' }}>
                        <div id="map" ref={mapRef} style={{ height: '100%', width: '100%', minHeight: '600px' }}></div>
                    </div>

                    {/* Results Section */}
                    <div className="card" style={{ padding: '1.5rem', maxHeight: '250px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Assignment Results</h3>
                        <div id="results" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
                            {processing ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '0.5rem' }}>
                                    <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Processing orders...
                                </div>
                            ) : assignmentHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: assignmentHtml }} />
                            ) : (
                                <p style={{ color: 'var(--text-muted)' }}>No routes assigned. Upload a CSV file to generate optimized routes.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* DRIVER DETAILS MODAL */}
            {selectedDriver && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }} onClick={closeModal}>
                    <div className="card" style={{ width: '450px', maxWidth: '90%', animation: 'fadeIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ color: 'var(--primary)', marginTop: 0 }}>{selectedDriver.name}</h2>
                        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                            <div>📧 {selectedDriver.email}</div>
                            <div>📞 {selectedDriver.phone || "N/A"}</div>
                        </div>

                        {selectedDriver.isApproved && (
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span>Status</span>
                                    <span style={{ color: selectedDriver.onDuty ? 'var(--secondary)' : 'var(--accent)', fontWeight: 'bold' }}>{selectedDriver.onDuty ? '🟢 On Duty' : '🔴 Off Duty'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Hardship Score</span>
                                    <span>{selectedDriver.averageHardshipScore?.toFixed(1) || 0}</span>
                                </div>
                                <hr style={{ opacity: 0.1, margin: '1rem 0' }} />

                                <h4 style={{ marginTop: 0 }}>Assigned Route</h4>
                                {driverRoute ? (
                                    <div style={{ fontSize: '0.9rem' }}>
                                        <div style={{ marginBottom: '0.5rem' }}><b>Region:</b> {driverRoute.region}</div>
                                        <div style={{ marginBottom: '0.5rem' }}><b>Stats:</b> {driverRoute.numberOfStops} stops • {driverRoute.totalDistance} km</div>
                                        <div><b>Total Difficulty:</b> <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{driverRoute.routeHardshipScore?.toFixed(1)}</span></div>
                                    </div>
                                ) : (
                                    <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No route assigned today.</div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={closeModal} className="btn" style={{ flex: 1, background: 'var(--bg-card-hover)' }}>Close</button>

                            {!selectedDriver.isApproved ? (
                                <>
                                    <button onClick={() => { handleApprove(selectedDriver._id); closeModal(); }} className="btn btn-secondary" style={{ flex: 1 }}>Approve</button>
                                    <button onClick={handleDeleteDriver} className="btn" style={{ flex: 1, background: 'var(--accent)', color: 'white' }}>Rejcet</button>
                                </>
                            ) : (
                                <button onClick={handleDeleteDriver} className="btn" style={{ flex: 1, background: 'rgba(244, 63, 94, 0.2)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>Remove Driver</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapDashboard;
