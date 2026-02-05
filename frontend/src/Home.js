import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="container fade-in" style={{ minHeight: 'calc(100vh - 400px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem', maxWidth: '700px' }}>
        <h1 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '3rem' }}>Welcome to EqualMiles</h1>
        <p style={{ fontSize: '1.25rem', margin: '0 auto', color: 'var(--text-muted)', lineHeight: '1.8' }}>
          Experience seamless logistics management with our advanced dispatcher and driver portal.
          Fair route distribution, real-time tracking, and efficient fleet management at your fingertips.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', width: '100%', maxWidth: '900px' }}>

        {/* Admin Section */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '70px', height: '70px', background: 'rgba(37, 52, 63, 0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--secondary)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>For Administrators</h2>
          <p style={{ marginBottom: '2rem', lineHeight: '1.6' }}>
            Access the comprehensive admin dashboard to manage your fleet, monitor routes in real-time,
            and make data-driven decisions for optimal logistics operations.
          </p>
          <button
            onClick={() => navigate('/admin/login')}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            Admin Dashboard →
          </button>
        </div>

        {/* Driver Section */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '70px', height: '70px', background: 'rgba(255, 155, 81, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--primary)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>For Drivers</h2>
          <p style={{ marginBottom: '2rem', lineHeight: '1.6' }}>
            Login to view your daily route assignments, update delivery status, track your miles,
            and manage your work schedule efficiently.
          </p>
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <button
              onClick={() => navigate('/driver/login')}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              Login
            </button>
            <button
              onClick={() => navigate('/driver/signup')}
              className="btn btn-outline"
              style={{ flex: 1 }}
            >
              Register
            </button>
          </div>
        </div>

      </div>

      {/* Features Section */}
      <div style={{ marginTop: '5rem', width: '100%', maxWidth: '900px' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2rem' }}>Why Choose EqualMiles?</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚖️</div>
            <h4 style={{ marginBottom: '0.5rem' }}>Fair Distribution</h4>
            <p style={{ fontSize: '0.9rem' }}>Intelligent route assignment ensures equitable workload distribution among drivers</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📍</div>
            <h4 style={{ marginBottom: '0.5rem' }}>Real-time Tracking</h4>
            <p style={{ fontSize: '0.9rem' }}>Monitor fleet movements and delivery status with live GPS tracking</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
            <h4 style={{ marginBottom: '0.5rem' }}>Analytics Dashboard</h4>
            <p style={{ fontSize: '0.9rem' }}>Comprehensive insights and reports for better decision making</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
