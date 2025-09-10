import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Navigation: React.FC = () => {
  const location = useLocation();

  return (
    <nav style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '10px 20px',
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #dee2e6',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', gap: '20px' }}>
        <Link 
          to="/" 
          style={{
            textDecoration: 'none',
            color: location.pathname === '/' ? '#007bff' : '#333',
            fontWeight: location.pathname === '/' ? 'bold' : 'normal',
            padding: '8px 16px',
            borderRadius: '4px',
            backgroundColor: location.pathname === '/' ? '#e3f2fd' : 'transparent'
          }}
        >
          Await-Tree Analyzer
        </Link>
        <Link 
          to="/graph" 
          style={{
            textDecoration: 'none',
            color: location.pathname === '/graph' ? '#007bff' : '#333',
            fontWeight: location.pathname === '/graph' ? 'bold' : 'normal',
            padding: '8px 16px',
            borderRadius: '4px',
            backgroundColor: location.pathname === '/graph' ? '#e3f2fd' : 'transparent'
          }}
        >
          Graph Visualizer
        </Link>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <a
          href="https://github.com/risingwavelabs/rw-diagnose-tools"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 16px',
            backgroundColor: '#24292f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'inline-block',
          }}
        >
          GitHub
        </a>
        <a
          href="https://github.com/risingwavelabs/rw-diagnose-tools/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'inline-block',
          }}
        >
          Submit Bug / Feedback
        </a>
      </div>
    </nav>
  );
};
