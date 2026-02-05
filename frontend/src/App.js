import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './Home';
import AdminDashboard from './MapDashboard';
import DriverDashboard from './DriverDashboard';
import AdminLogin from './AdminLogin';
import DriverLogin from './DriverLogin';
import DriverSignup from './DriverSignup';
import './App.css';

function AppContent() {
  const location = useLocation();

  // Hide footer on dashboard pages (but show navbar everywhere)
  const isDashboardPage = (location.pathname.includes('/admin') && !location.pathname.includes('/login')) ||
    (location.pathname.includes('/driver/') && !location.pathname.includes('/login') && !location.pathname.includes('/signup'));

  return (
    <div className="App" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />

          <Route path="/driver/login" element={<DriverLogin />} />
          <Route path="/driver/signup" element={<DriverSignup />} />
          <Route path="/driver/:id" element={<DriverDashboard />} />
        </Routes>
      </main>

      {!isDashboardPage && <Footer />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
