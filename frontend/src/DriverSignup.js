import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DriverSignup = () => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/drivers/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                alert("Registration successful! Please wait for admin approval (or login if auto-approved).");
                navigate('/driver/login');
            } else {
                const data = await res.json();
                alert(data.message || "Signup failed");
            }
        } catch (err) {
            console.error(err);
            alert("Signup failed");
        }
    };

    return (
        <div className="container flex-center fade-in" style={{ minHeight: 'calc(100vh - 350px)', padding: '3rem 2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '3rem 2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '0.5rem' }}>Driver Registration</h2>
                    <p style={{ margin: 0 }}>Join our fleet today</p>
                </div>

                <form onSubmit={handleSignup}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label className="input-label">Full Name</label>
                        <input
                            type="text"
                            placeholder="e.g. John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="input-field"
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label className="input-label">Email Address</label>
                        <input
                            type="email"
                            placeholder="e.g. john@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="input-field"
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label className="input-label">Phone Number</label>
                        <input
                            type="tel"
                            placeholder="+91 98765 43210"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="input-field"
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '2rem' }}>
                        <label className="input-label">Password</label>
                        <input
                            type="password"
                            placeholder="Create a password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="input-field"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        Register Now
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Already registered? </span>
                    <button
                        onClick={() => navigate('/driver/login')}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                        Log In
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DriverSignup;
