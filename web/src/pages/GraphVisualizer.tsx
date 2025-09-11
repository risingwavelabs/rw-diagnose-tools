import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import dagre from 'dagre';
import { CSVParser, ParsedGraphData } from '../utils/csvParser';

type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

export const GraphVisualizer: React.FC = () => {
  const [nodeDefinitionsFile, setNodeDefinitionsFile] = useState<File | null>(null);
  const [dependenciesFile, setDependenciesFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('TB');
  const [ignoreHeaders, setIgnoreHeaders] = useState<boolean>(false);
  const ignoreHeadersRef = useRef<boolean>(false);
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
      const currentIgnoreHeaders = ignoreHeadersRef.current;
      console.log('🔍 DEBUG: About to parse with ignoreHeaders:', currentIgnoreHeaders);
      const data = CSVParser.parseGraphData(nodeDefinitionsContent, dependenciesContent, currentIgnoreHeaders);
      console.log('🔍 DEBUG: Parsed data:', data);
      console.log('🔍 DEBUG: Dependencies with color weights:', data.dependencies.filter(dep => dep.color_weight !== undefined));
      console.log('🔍 DEBUG: ignoreHeaders was:', currentIgnoreHeaders);
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
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Draw graph on canvas using dagre layout
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !parsedData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { nodes, dependencies } = parsedData;
    
    // Create a new directed graph
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: layoutDirection, // Layout direction
      align: 'UL',   // Upper Left alignment
      nodesep: 50,   // Node separation
      ranksep: 80,   // Rank separation
      marginx: 20,   // Margin X
      marginy: 20,   // Margin Y
    });

    // Set default edge label
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to the graph
    nodes.forEach(node => {
      // Estimate text width for node sizing
      ctx.font = '12px Arial';
      const textWidth = ctx.measureText(node.name).width;
      const nodeWidth = Math.max(80, textWidth + 20);
      const nodeHeight = 40;
      
      g.setNode(node.id, {
        width: nodeWidth,
        height: nodeHeight,
        label: node.name
      });
    });

    // Add edges to the graph
    dependencies.forEach(dep => {
      g.setEdge(dep.upstream_relation_id, dep.downstream_relation_id);
    });

    // Run the layout algorithm
    dagre.layout(g);

    // Get the graph dimensions
    const graphWidth = g.graph().width || 400;
    const graphHeight = g.graph().height || 300;

    // Calculate scaling and centering
    const scaleX = (canvas.width - 40) / graphWidth;
    const scaleY = (canvas.height - 40) / graphHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

    const offsetX = (canvas.width - graphWidth * scale) / 2;
    const offsetY = (canvas.height - graphHeight * scale) / 2;

    // Helper function to get edge color based on weight
    const getEdgeColor = (weight?: number): string => {
      if (weight === undefined) {
        return '#666'; // Default gray for edges without weight
      }
      
      // Create a smooth spectrum from green to red
      // 0 = pure green, 0.5 = yellow, 1 = pure red
      // Use a more sophisticated color mapping for better visual distinction
      
      if (weight <= 0) {
        return '#00FF00'; // Pure green
      } else if (weight >= 1) {
        return '#FF0000'; // Pure red
      } else if (weight <= 0.5) {
        // Green to yellow transition (0 to 0.5)
        const ratio = weight * 2; // Scale to 0-1
        const red = Math.round(255 * ratio);
        const green = 255;
        const blue = 0;
        return `rgb(${red}, ${green}, ${blue})`;
      } else {
        // Yellow to red transition (0.5 to 1)
        const ratio = (weight - 0.5) * 2; // Scale to 0-1
        const red = 255;
        const green = Math.round(255 * (1 - ratio));
        const blue = 0;
        return `rgb(${red}, ${green}, ${blue})`;
      }
    };

    // Draw edges first (so they appear behind nodes)
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    g.edges().forEach(edge => {
      const edgeData = g.edge(edge);
      if (edgeData && edgeData.points) {
        // Find the corresponding dependency to get the color weight
        const dependency = dependencies.find(dep => 
          dep.upstream_relation_id === edge.v && dep.downstream_relation_id === edge.w
        );
        
        // Debug logging
        console.log(`🔍 DEBUG: Edge ${edge.v} -> ${edge.w}:`, {
          dependency,
          colorWeight: dependency?.color_weight,
          edgeColor: getEdgeColor(dependency?.color_weight)
        });
        
        // Set edge color based on weight
        ctx.strokeStyle = getEdgeColor(dependency?.color_weight);
        
        ctx.beginPath();
        ctx.moveTo(
          edgeData.points[0].x * scale + offsetX,
          edgeData.points[0].y * scale + offsetY
        );
        
        // Draw curved edges if there are multiple points
        if (edgeData.points.length > 2) {
          for (let i = 1; i < edgeData.points.length - 1; i++) {
            const point = edgeData.points[i];
            ctx.lineTo(point.x * scale + offsetX, point.y * scale + offsetY);
          }
        }
        
        const endPoint = edgeData.points[edgeData.points.length - 1];
        ctx.lineTo(endPoint.x * scale + offsetX, endPoint.y * scale + offsetY);
        ctx.stroke();

        // Draw arrow at the end with the same color
        if (edgeData.points.length >= 2) {
          const lastPoint = edgeData.points[edgeData.points.length - 1];
          const secondLastPoint = edgeData.points[edgeData.points.length - 2];
          
          const angle = Math.atan2(
            lastPoint.y - secondLastPoint.y,
            lastPoint.x - secondLastPoint.x
          );
          
          const arrowLength = 10;
          const arrowAngle = Math.PI / 6;
          
          ctx.beginPath();
          ctx.moveTo(lastPoint.x * scale + offsetX, lastPoint.y * scale + offsetY);
          ctx.lineTo(
            (lastPoint.x - arrowLength * Math.cos(angle - arrowAngle)) * scale + offsetX,
            (lastPoint.y - arrowLength * Math.sin(angle - arrowAngle)) * scale + offsetY
          );
          ctx.moveTo(lastPoint.x * scale + offsetX, lastPoint.y * scale + offsetY);
          ctx.lineTo(
            (lastPoint.x - arrowLength * Math.cos(angle + arrowAngle)) * scale + offsetX,
            (lastPoint.y - arrowLength * Math.sin(angle + arrowAngle)) * scale + offsetY
          );
          ctx.stroke();
        }
      }
    });

    // Draw nodes
    g.nodes().forEach(nodeId => {
      const nodeData = g.node(nodeId);
      if (!nodeData) return;

      const x = nodeData.x * scale + offsetX;
      const y = nodeData.y * scale + offsetY;
      const width = nodeData.width * scale;
      const height = nodeData.height * scale;

      // Node rectangle
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(x - width / 2, y - height / 2, width, height);
      
      // Node border
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - width / 2, y - height / 2, width, height);

      // Node label
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Truncate long names if needed
      let displayName = nodeData.label || '';
      const maxWidth = width - 10;
      while (ctx.measureText(displayName).width > maxWidth && displayName.length > 3) {
        displayName = displayName.substring(0, displayName.length - 4) + '...';
      }
      
      ctx.fillText(displayName, x, y);
    });
  }, [parsedData, layoutDirection]);

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
            Expected format: upstream_relation_id,downstream_relation_id[,color_weight] (e.g., "node1,node2,0.8")
            <br />
            <strong>color_weight</strong> (optional): Number between 0-1 for edge coloring (0=green, 1=red)
          </small>
          {dependenciesFile && (
            <div style={{ color: 'green', fontSize: '14px', marginTop: '5px' }}>
              ✓ {dependenciesFile.name}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={ignoreHeaders}
              onChange={(e) => {
                console.log('🔍 DEBUG: Checkbox changed to:', e.target.checked);
                setIgnoreHeaders(e.target.checked);
                ignoreHeadersRef.current = e.target.checked;
              }}
              style={{ margin: 0 }}
            />
            <span>Ignore CSV headers (treat first row as data)</span>
          </label>
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            Check this if your CSV files don't have headers or have different header formats
          </small>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Graph Visualization</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Layout Direction:</label>
              <select
                value={layoutDirection}
                onChange={(e) => setLayoutDirection(e.target.value as LayoutDirection)}
                style={{
                  padding: '5px 10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="TB">Top to Bottom</option>
                <option value="BT">Bottom to Top</option>
                <option value="LR">Left to Right</option>
                <option value="RL">Right to Left</option>
              </select>
            </div>
          </div>
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
          <div style={{ marginTop: '15px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
            
            {/* Color Legend */}
            {parsedData.dependencies.some(dep => dep.color_weight !== undefined) && (
              <div style={{ 
                padding: '10px', 
                backgroundColor: '#fff3e0', 
                borderRadius: '4px',
                minWidth: '250px'
              }}>
                <strong>Edge Color Spectrum:</strong>
                <div style={{ marginTop: '8px' }}>
                  {/* Color gradient bar */}
                  <div style={{ 
                    width: '200px', 
                    height: '20px', 
                    background: 'linear-gradient(to right, #00FF00, #FFFF00, #FF0000)',
                    borderRadius: '3px',
                    border: '1px solid #ccc',
                    marginBottom: '5px'
                  }}></div>
                  {/* Labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#666' }}>
                    <span>0 (Low)</span>
                    <span>0.5 (Medium)</span>
                    <span>1 (High)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sample CSV Format */}
      <div style={{ marginTop: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
        <h4>Sample CSV Format</h4>
        
        <div style={{ marginBottom: '15px' }}>
          <strong>With Headers (default):</strong>
        </div>
        
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
{`upstream_relation_id,downstream_relation_id,color_weight
node1,node2,0.2
node2,node3,0.8
node3,node4,0.5`}
          </pre>
          <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
            <strong>Note:</strong> The color_weight column is optional. If omitted, edges will be gray.
            <br />
            Values: 0 = green (low), 0.5 = yellow (medium), 1 = red (high) - smooth spectrum
          </small>
        </div>

        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
          <strong>Without Headers (check "Ignore CSV headers"):</strong>
          <div style={{ marginTop: '10px' }}>
            <strong>Node Definitions CSV:</strong>
            <pre style={{ 
              backgroundColor: '#fff', 
              padding: '10px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              marginTop: '5px',
              fontSize: '12px'
            }}>
{`node1,Source Table
node2,Filter Operation
node3,Join Operation
node4,Output Table`}
            </pre>
          </div>
          
          <div style={{ marginTop: '10px' }}>
            <strong>Dependencies CSV:</strong>
            <pre style={{ 
              backgroundColor: '#fff', 
              padding: '10px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              marginTop: '5px',
              fontSize: '12px'
            }}>
{`node1,node2,0.2
node2,node3,0.8
node3,node4,0.5`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
