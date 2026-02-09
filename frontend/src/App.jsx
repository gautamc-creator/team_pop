import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Docs from './pages/Docs';
import GetStarted from './pages/GetStarted';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/get-started" element={<GetStarted />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
