import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { CSVParser, ParsedGraphData, GraphNode, GraphDependency } from '../utils/csvParser';

export const GraphVisualizer: React.FC = () => {
  const [nodeDefinitionsFile, setNodeDefinitionsFile] = useState<File | null>(null);
  const [dependenciesFile, setDependenciesFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle file uploads
  const handleNodeDefinitionsFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setNodeDefinitionsFile(file || null);
    setError(null);
  }, []);

  const handleDependenciesFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setDependenciesFile(file || null);
    setError(null);
  }, []);

  // Parse CSV files and create graph
  const handleParseFiles = useCallback(async () => {
    if (!nodeDefinitionsFile || !dependenciesFile) {
      setError('Please upload both CSV files');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Read both files
      const [nodeDefinitionsContent, dependenciesContent] = await Promise.all([
        readFileAsText(nodeDefinitionsFile),
        readFileAsText(dependenciesFile)
      ]);

      // Parse the CSV data
      const data = CSVParser.parseGraphData(nodeDefinitionsContent, dependenciesContent);
      setParsedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV files');
      setParsedData(null);
    } finally {
      setIsLoading(false);
    }
  }, [nodeDefinitionsFile, dependenciesFile]);

  // Helper function to read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Draw graph on canvas
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !parsedData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { nodes, dependencies } = parsedData;
    
    // Simple layout: arrange nodes in a circle
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 3;
    
    // Calculate node positions
    const nodePositions = new Map<string, { x: number; y: number }>();
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      nodePositions.set(node.id, { x, y });
    });

    // Draw edges first (so they appear behind nodes)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    dependencies.forEach(dep => {
      const upstreamPos = nodePositions.get(dep.upstream_relation_id);
      const downstreamPos = nodePositions.get(dep.downstream_relation_id);
      
      if (upstreamPos && downstreamPos) {
        ctx.beginPath();
        ctx.moveTo(upstreamPos.x, upstreamPos.y);
        ctx.lineTo(downstreamPos.x, downstreamPos.y);
        ctx.stroke();
        
        // Draw arrow
        const angle = Math.atan2(downstreamPos.y - upstreamPos.y, downstreamPos.x - upstreamPos.x);
        const arrowLength = 10;
        const arrowAngle = Math.PI / 6;
        
        ctx.beginPath();
        ctx.moveTo(downstreamPos.x, downstreamPos.y);
        ctx.lineTo(
          downstreamPos.x - arrowLength * Math.cos(angle - arrowAngle),
          downstreamPos.y - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(downstreamPos.x, downstreamPos.y);
        ctx.lineTo(
          downstreamPos.x - arrowLength * Math.cos(angle + arrowAngle),
          downstreamPos.y - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      // Node circle
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20, 0, 2 * Math.PI);
      ctx.fill();
      
      // Node border
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Node label
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Truncate long names
      const displayName = node.name.length > 15 ? node.name.substring(0, 12) + '...' : node.name;
      ctx.fillText(displayName, pos.x, pos.y);
    });
  }, [parsedData]);

  // Redraw graph when data changes
  useEffect(() => {
    drawGraph();
  }, [drawGraph]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = Math.max(400, container.clientHeight);
        drawGraph();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawGraph]);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', lineHeight: '1.6' }}>
      <h1>Graph Visualizer</h1>
      <p>Upload CSV files containing graph node definitions and dependencies to visualize the graph structure.</p>

      {/* File Upload Section */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fafafa' }}>
        <h3>Upload CSV Files</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="nodeDefinitionsFile" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Node Definitions CSV:
          </label>
          <input
            type="file"
            id="nodeDefinitionsFile"
            accept=".csv"
            onChange={handleNodeDefinitionsFileChange}
            style={{ marginBottom: '5px' }}
          />
          <small style={{ color: '#666', display: 'block' }}>
            Expected format: id,name (e.g., "node1,Node One")
          </small>
          {nodeDefinitionsFile && (
            <div style={{ color: 'green', fontSize: '14px', marginTop: '5px' }}>
              ✓ {nodeDefinitionsFile.name}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="dependenciesFile" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Dependencies CSV:
          </label>
          <input
            type="file"
            id="dependenciesFile"
            accept=".csv"
            onChange={handleDependenciesFileChange}
            style={{ marginBottom: '5px' }}
          />
          <small style={{ color: '#666', display: 'block' }}>
            Expected format: upstream_relation_id,downstream_relation_id (e.g., "node1,node2")
          </small>
          {dependenciesFile && (
            <div style={{ color: 'green', fontSize: '14px', marginTop: '5px' }}>
              ✓ {dependenciesFile.name}
            </div>
          )}
        </div>

        <button
          onClick={handleParseFiles}
          disabled={!nodeDefinitionsFile || !dependenciesFile || isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            opacity: (!nodeDefinitionsFile || !dependenciesFile || isLoading) ? 0.6 : 1
          }}
        >
          {isLoading ? 'Parsing...' : 'Parse and Visualize Graph'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '10px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          border: '1px solid #f5c6cb', 
          borderRadius: '4px' 
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Graph Visualization */}
      {parsedData && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Graph Visualization</h3>
          <div style={{ 
            border: '1px solid #ccc', 
            borderRadius: '4px', 
            padding: '10px',
            backgroundColor: '#fff',
            minHeight: '400px'
          }}>
            <canvas
              ref={canvasRef}
              style={{ 
                width: '100%', 
                height: '400px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
          
          {/* Graph Statistics */}
          <div style={{ marginTop: '15px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ 
              padding: '10px', 
              backgroundColor: '#e3f2fd', 
              borderRadius: '4px',
              minWidth: '150px'
            }}>
              <strong>Nodes:</strong> {parsedData.nodes.length}
            </div>
            <div style={{ 
              padding: '10px', 
              backgroundColor: '#f3e5f5', 
              borderRadius: '4px',
              minWidth: '150px'
            }}>
              <strong>Dependencies:</strong> {parsedData.dependencies.length}
            </div>
          </div>
        </div>
      )}

      {/* Sample CSV Format */}
      <div style={{ marginTop: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
        <h4>Sample CSV Format</h4>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>Node Definitions CSV (nodes.csv):</strong>
          <pre style={{ 
            backgroundColor: '#fff', 
            padding: '10px', 
            border: '1px solid #ccc', 
            borderRadius: '4px',
            marginTop: '5px',
            fontSize: '12px'
          }}>
{`id,name
node1,Source Table
node2,Filter Operation
node3,Join Operation
node4,Output Table`}
          </pre>
        </div>

        <div>
          <strong>Dependencies CSV (dependencies.csv):</strong>
          <pre style={{ 
            backgroundColor: '#fff', 
            padding: '10px', 
            border: '1px solid #ccc', 
            borderRadius: '4px',
            marginTop: '5px',
            fontSize: '12px'
          }}>
{`upstream_relation_id,downstream_relation_id
node1,node2
node2,node3
node3,node4`}
          </pre>
        </div>
      </div>
    </div>
  );
};
