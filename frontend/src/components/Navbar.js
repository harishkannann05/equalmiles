import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoMain from '../equalmiles_logo2.png';

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    // Check if user is logged in
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const isLoggedIn = !!token;

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    return (
        <nav style={{
            background: '#E2A16F',
            borderBottom: '1px solid #D18F5A',
            padding: '1rem 0',
            position: 'sticky',
            top: 0,
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(226, 161, 111, 0.25)'
        }}>
            <div className="container" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 2rem'
            }}>
                {/* Logo Section */}
                <div
                    onClick={() => navigate('/')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        cursor: 'pointer'
                    }}
                >
                    <img src={logoMain} alt="EqualMiles" style={{ height: '40px' }} />
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>EqualMiles</h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>Transport Systems</p>
                    </div>
                </div>

                {/* Navigation Links */}
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: isActive('/') ? 'white' : 'rgba(255,255,255,0.85)',
                            fontWeight: isActive('/') ? '700' : '500',
                            cursor: 'pointer',
                            textDecoration: 'none',
                            transition: 'var(--transition)',
                            fontSize: '0.95rem',
                            padding: 0
                        }}
                    >
                        Home
                    </button>

                    {isLoggedIn ? (
                        <>
                            {role === 'admin' && (
                                <button
                                    onClick={() => navigate('/admin')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: isActive('/admin') ? 'white' : 'rgba(255,255,255,0.85)',
                                        fontWeight: isActive('/admin') ? '700' : '500',
                                        cursor: 'pointer',
                                        textDecoration: 'none',
                                        transition: 'var(--transition)',
                                        fontSize: '0.95rem',
                                        padding: 0
                                    }}
                                >
                                    Dashboard
                                </button>
                            )}

                            <button
                                className="btn"
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.9rem',
                                    background: 'white',
                                    color: '#E2A16F',
                                    border: '2px solid white'
                                }}
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="btn"
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.9rem',
                                    background: 'transparent',
                                    color: 'white',
                                    border: '2px solid white'
                                }}
                                onClick={() => navigate('/driver/login')}
                            >
                                Driver Portal
                            </button>

                            <button
                                className="btn"
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.9rem',
                                    background: 'white',
                                    color: '#E2A16F',
                                    border: '2px solid white'
                                }}
                                onClick={() => navigate('/admin/login')}
                            >
                                Admin Login
                            </button>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
