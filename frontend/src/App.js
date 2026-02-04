import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import AdminDashboard from './MapDashboard';
import DriverDashboard from './DriverDashboard';
import AdminLogin from './AdminLogin';
import DriverLogin from './DriverLogin';
import DriverSignup from './DriverSignup';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />

          <Route path="/driver/login" element={<DriverLogin />} />
          <Route path="/driver/signup" element={<DriverSignup />} />
          <Route path="/driver/:id" element={<DriverDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
