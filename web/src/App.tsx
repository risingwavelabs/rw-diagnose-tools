import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { AwaitTreeAnalyzer } from './pages/AwaitTreeAnalyzer';
import { GraphVisualizer } from './pages/GraphVisualizer';

function App() {
  return (
    <Router>
      <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        <Navigation />
        <Routes>
          <Route path="/" element={<AwaitTreeAnalyzer />} />
          <Route path="/graph" element={<GraphVisualizer />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
