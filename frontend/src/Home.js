import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
      <h1>EqualMiles Dispatch Portal</h1>
      <p style={{ color: '#666', fontSize: '1.2em' }}>Fair and Efficient Route Assignment System</p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '50px' }}>

        {/* Admin Section */}
        <div style={{ flex: 1, padding: '30px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', backgroundColor: '#f8f9fa' }}>
          <h2 style={{ color: '#007bff' }}>For Admins</h2>
          <p>Login to manage drivers and routes.</p>
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => navigate('/admin/login')}
              style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
            >
              Admin Login
            </button>
          </div>
        </div>

        {/* Driver Section */}
        <div style={{ flex: 1, padding: '30px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', backgroundColor: '#fff' }}>
          <h2 style={{ color: '#28a745' }}>For Drivers</h2>
          <p>Register, view assigned routes, and manage availability.</p>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/driver/login')}
              style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
            >
              Login
            </button>
            <button
              onClick={() => navigate('/driver/signup')}
              style={{ padding: '10px 20px', background: 'white', color: '#28a745', border: '2px solid #28a745', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
            >
              Sign Up
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Home;
