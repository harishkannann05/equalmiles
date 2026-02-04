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

const MapDashboard = () => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const navigate = useNavigate();

    // Pending Drivers State
    // Pending & Active Drivers State
    // Driver States
    const [pendingDrivers, setPendingDrivers] = useState([]);
    const [onDutyDrivers, setOnDutyDrivers] = useState([]);
    const [offDutyDrivers, setOffDutyDrivers] = useState([]);

    // Modal State
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [driverRoute, setDriverRoute] = useState(null);

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
    const office = [77.710, 11.327];

    const getCoordinates = (order) => {
        // 1. Try DB Coordinates
        if (order.coordinates && order.coordinates.lat && order.coordinates.lng) {
            return [order.coordinates.lng, order.coordinates.lat]; // Leaflet uses [lat, lng] usually, but let's check format
            // Wait, previous code used [77.71, 11.32] which is [lng, lat] for some reason in drawing?
            // Let's re-verify: L.marker([lat, lng]) BUT my code uses [s[1], s[0]] in drawing marker.
            // My getCoordinates returns [lng, lat].
            // So I should return [lng, lat] here too.
            // return [order.coordinates.lng, order.coordinates.lat];
        }

        // 2. Fallback to Address
        const rawAddress = order.address;
        if (!rawAddress) {
            // console.warn("getCoordinates: Empty address");
            return null;
        }
        const address = rawAddress.toLowerCase();

        // console.log("Geocoding:", address); 

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

            // Use standard for loop to avoid ESLint no-loop-func error
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

            // Tiny pause between segments to avoid 429
            await new Promise(r => setTimeout(r, 100));
        }

        // --- 3. Draw Markers (Sorted Order) ---
        sortedStops.forEach((s, i) => {
            const isLast = i === sortedStops.length - 1;

            // User Request: Only show Start (Office) and Last Stop (Final Destination)
            // Intermediate stops are hidden to keep the map clean.

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
            "#007bff", "#dc3545", "#28a745", "#6f42c1", "#fd7e14", "#d63384", "#17a2b8", "#6610f2", "#20c997", "#343a40"
        ];

        // Process sequentially to avoid OSRM Rate Limiting (429)
        // Free server blocks if we send 50+ requests at once.
        for (let i = 0; i < routes.length; i++) {
            const route = routes[i];
            if (!route.orders || route.orders.length === 0) continue;

            const stops = route.orders.map(o => getCoordinates(o)).filter(Boolean);
            if (stops.length === 0) continue;

            const driverMock = {
                name: `Route ${route.region}`, // (Driver info might need fetching if not in route object)
                color: colors[i % colors.length],
                stops: stops
            };

            // Draw this driver's route
            await drawMultiStopRoute(driverMock);

            // Small pause between drivers to be polite to the server
            await new Promise(r => setTimeout(r, 500));
        }
    }, [drawMultiStopRoute]);

    const processCSV = async () => {
        const fileInput = document.getElementById("csvFile");
        const file = fileInput?.files[0];
        if (!file) return alert("Please select a CSV file first.");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const resultsDiv = document.getElementById("results");
            if (resultsDiv) resultsDiv.innerHTML = "<p>Processing orders and assigning routes...</p>";

            const res = await fetch("/api/admin/upload-csv", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Success! Generated and assigned ${data.routes.length} routes.`);
                fetchData(); // Refresh everything

                if (resultsDiv) {
                    let html = "<h3>✅ Assignment Complete</h3>";
                    html += "<div style='font-size: 0.9em;'>";

                    // Sort routes by score (Hardest first)
                    const sortedRoutes = data.routes.sort((a, b) => b.routeHardshipScore - a.routeHardshipScore);

                    sortedRoutes.forEach((route, i) => {
                        // Find driver name from state
                        const driver = onDutyDrivers.find(d => d._id === route.assignedDriverId);
                        const driverName = driver ? driver.name : "Unknown Driver";
                        const color = ["blue", "green", "red", "orange", "purple", "brown"][i % 6];

                        html += `
                                <div style="border-left: 5px solid ${color}; background: white; padding: 10px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <h4 style="margin: 0;">${driverName}</h4>
                                        <span style="background: #eee; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Score: ${route.routeHardshipScore?.toFixed(1)}</span>
                                    </div>
                                    <p style="margin: 5px 0; font-size: 0.85em; color: #666;">
                                        ${route.orders.length} Stops • ${route.totalDistance} km
                                    </p>
                                    <details style="margin-top: 5px;">
                                        <summary style="cursor: pointer; color: #007bff; font-weight: bold; font-size: 0.85em;">View Stops</summary>
                                        <ul style="padding-left: 20px; margin: 5px 0; font-size: 0.85em; color: #333;">
                                            ${route.orders.map((o, idx) => {
                            const addr = o.address ? o.address.split(',')[0] : "Unknown Address";
                            return `
                                                <li style="margin-bottom: 4px;">
                                                    <b>#${idx + 1}:</b> ${addr} 
                                                    <br/>
                                                    <span style="font-size: 0.8em; color: #555;">
                                                        Mode: <b>${o.mode || 'N/A'}</b> | Priority: <b>${o.priority || 'Normal'}</b>
                                                    </span>
                                                </li>
                                                `;
                        }).join('')}
                                        </ul>
                                    </details>
                                </div>
                            `;
                    });
                    html += "</div>";
                    resultsDiv.innerHTML = html;
                }

                // Visualize on Map immediately
                if (mapInstanceRef.current) {
                    // Clear existing layers safely if needed (optional for now, as Leaflet just adds on top)
                    // A simpler way is to just call our visualizer
                    visualizeRoutes(data.routes);
                }
            } else {
                const err = await res.json();
                alert("Error: " + (err.message || "Failed to process CSV"));
                if (resultsDiv) resultsDiv.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload file: " + err.message);
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

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const fetchData = React.useCallback(async () => {
        // Refresh Pending/Approved drivers
        fetchPendingDrivers();
        fetchApprovedDrivers();

        // Refresh Routes
        try {
            const res = await fetch("/api/admin/routes");
            const routes = await res.json();
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
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1>EqualMiles Admin Dashboard</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={fetchData}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                    >
                        🔄 Refresh Map
                    </button>
                    <button
                        onClick={toggleDutyLock}
                        style={{
                            padding: '8px 16px',
                            background: dutyLocked ? '#dc3545' : '#28a745',
                            color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        {dutyLocked ? "Unlock Duty 🔓" : "Lock Duty 🔒"}
                    </button>
                    <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
                </div>
            </div>

            {/* Pending Approvals Section */}
            <div style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffeeba' }}>
                <h3>⏳ Pending Driver Approvals</h3>
                {pendingDrivers.length === 0 ? <p>No pending approvals.</p> : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {pendingDrivers.map(d => (
                            <li key={d._id} onClick={() => handleDriverClick(d)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'white', marginBottom: '5px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ccc' }}>
                                <span>{d.name} ({d.email})</span>
                                <span style={{ fontSize: '0.8em', color: '#856404' }}>View Details</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Active (On Duty) Drivers Section */}
            <div style={{ padding: '15px', background: '#d4edda', borderRadius: '8px', marginBottom: '20px', border: '1px solid #c3e6cb' }}>
                <h3>🟢 On-Duty Drivers</h3>
                {onDutyDrivers.length === 0 ? <p>No drivers currently on duty.</p> : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {onDutyDrivers.map(d => (
                            <li key={d._id} onClick={() => handleDriverClick(d)} style={{ padding: '10px', background: 'white', marginBottom: '5px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #ccc' }}>
                                <b>{d.name}</b> ({d.email})
                                <span style={{ float: 'right', fontSize: '0.8em', color: '#28a745' }}>View Details</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Off Duty Drivers Section */}
            <div style={{ padding: '15px', background: '#e2e3e5', borderRadius: '8px', marginBottom: '20px', border: '1px solid #d6d8db' }}>
                <h3>🔴 Off-Duty Drivers</h3>
                {offDutyDrivers.length === 0 ? <p>No off-duty drivers.</p> : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {offDutyDrivers.map(d => (
                            <li key={d._id} onClick={() => handleDriverClick(d)} style={{ padding: '10px', background: 'white', marginBottom: '5px', borderRadius: '4px', color: '#666', cursor: 'pointer', border: '1px solid #ccc' }}>
                                <b>{d.name}</b> ({d.email})
                                <span style={{ float: 'right', fontSize: '0.8em' }}>View Details</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* DRIVER DETAILS MODAL */}
            {selectedDriver && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
                        <h2>{selectedDriver.name}</h2>
                        <p><b>Email:</b> {selectedDriver.email}</p>
                        <p><b>Phone:</b> {selectedDriver.phone || "N/A"}</p>

                        {selectedDriver.isApproved && (
                            <>
                                <p><b>Status:</b> {selectedDriver.onDuty ? '🟢 On Duty' : '🔴 Off Duty'}</p>
                                <p><b>Hardship Avg:</b> {selectedDriver.averageHardshipScore?.toFixed(1) || 0}</p>
                                <hr />
                                <h3>Assigned Route</h3>
                                {driverRoute ? (
                                    <div>
                                        <p><b>Region:</b> {driverRoute.region}</p>
                                        <p><b>Stops:</b> {driverRoute.numberOfStops}</p>
                                        <p><b>Distance:</b> {driverRoute.totalDistance} km</p>
                                        <p><b>Score Breakdown:</b></p>
                                        <ul style={{ fontSize: '0.9em', color: '#555', paddingLeft: '20px', marginTop: '5px' }}>
                                            <li>Base (Dist/Stops): {(driverRoute.routeHardshipScore - (driverRoute.modeScore || 0) - (driverRoute.priorityScore || 0)).toFixed(1)}</li>
                                            <li>Mode Difficulty: +{driverRoute.modeScore || 0}</li>
                                            <li>Priority Bonus: +{driverRoute.priorityScore || 0}</li>
                                        </ul>
                                        <p><b>Total Hardship Score:</b> <b style={{ color: '#d9534f' }}>{driverRoute.routeHardshipScore?.toFixed(1)}</b></p>
                                    </div>
                                ) : (
                                    <p><i>No route currently assigned.</i></p>
                                )}
                            </>
                        )}
                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                            <button onClick={closeModal} style={{ flex: 1, padding: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Close</button>

                            {!selectedDriver.isApproved ? (
                                <>
                                    <button onClick={() => { handleApprove(selectedDriver._id); closeModal(); }} style={{ flex: 1, padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Approve</button>
                                    <button onClick={handleDeleteDriver} style={{ flex: 1, padding: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Not Approve</button>
                                </>
                            ) : (
                                <button onClick={handleDeleteDriver} style={{ flex: 1, padding: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Remove Driver</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '20px' }}>
                <input type="file" id="csvFile" accept=".csv" />
                <button
                    onClick={processCSV}
                    style={{
                        marginLeft: '10px',
                        padding: '8px 16px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Process Orders
                </button>
                <button
                    onClick={async () => {
                        if (window.confirm("Are you sure you want to RESET all routes? This will delete current assignments.")) {
                            try {
                                const res = await fetch("/api/admin/reset-routes", { method: "DELETE" });
                                const data = await res.json();
                                alert(data.message);
                                window.location.reload(); // Reload to clear map and state
                            } catch (err) {
                                alert("Failed to reset routes");
                            }
                        }
                    }}
                    style={{
                        marginLeft: '10px',
                        padding: '8px 16px',
                        backgroundColor: '#dc3545', // Red for danger/reset
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Reset Routes 🔄
                </button>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                <div
                    id="map"
                    ref={mapRef}
                    style={{ height: '500px', width: '70%', borderRadius: '8px', border: '1px solid #ddd' }}
                ></div>

                <div
                    id="results"
                    style={{
                        width: '30%',
                        maxHeight: '500px',
                        overflowY: 'auto',
                        backgroundColor: '#f8f9fa',
                        padding: '10px',
                        borderRadius: '8px'
                    }}
                >
                    <h3>Results will appear here...</h3>
                </div>
            </div>
        </div>
    );
};

export default MapDashboard;
