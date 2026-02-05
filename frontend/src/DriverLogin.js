import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DriverLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/drivers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", "driver");
        // Handle both 'id' and 'driverId' from backend
        const driverId = data.id || data.driverId;
        if (driverId) {
          navigate(`/driver/${driverId}`);
        } else {
          alert("Login successful but driver ID not found");
        }
      } else {
        alert(data.message || "Login failed");
      }
    } catch (err) {
      console.error(err);
      alert("Login failed. Please check your connection.");
    }
  };

  return (
    <div className="container flex-center fade-in" style={{ minHeight: 'calc(100vh - 350px)', padding: '3rem 2rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '3rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Driver Login</h2>
          <p style={{ margin: 0 }}>Access your route dashboard</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="input-label">Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <label className="input-label">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Log In
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Don't have an account? </span>
          <button
            onClick={() => navigate('/driver/signup')}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Register here
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverLogin;
