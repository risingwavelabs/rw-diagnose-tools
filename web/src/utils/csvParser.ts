export interface GraphNode {
  id: string;
  name: string;
}

export interface GraphDependency {
  upstream_relation_id: string;
  downstream_relation_id: string;
  color_weight?: number; // Optional weight for edge coloring (0-1)
}

export interface ParsedGraphData {
  nodes: GraphNode[];
  dependencies: GraphDependency[];
}

export class CSVParser {
  /**
   * Parse CSV content into an array of objects
   */
  private static parseCSV(csvContent: string): string[][] {
    const lines = csvContent.trim().split('\n');
    return lines.map(line => {
      // Simple CSV parsing - handles basic cases
      // For more complex CSV with quoted fields, consider using a library like papaparse
      return line.split(',').map(field => field.trim());
    });
  }

  /**
   * Parse node definitions CSV
   * Expected format: id,name
   */
  static parseNodeDefinitions(csvContent: string, ignoreHeaders: boolean = false): GraphNode[] {
    const rows = this.parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Check if header exists and matches expected format
    const header = rows[0];
    
    if (header.length < 2) {
      throw new Error('Node definitions CSV must have at least 2 columns: id, name');
    }

    // Skip header row if it matches expected format (unless ignoreHeaders is true)
    const dataRows = !ignoreHeaders && header[0].toLowerCase() === 'id' && header[1].toLowerCase() === 'name' 
      ? rows.slice(1) 
      : ignoreHeaders 
        ? rows // When ignoring headers, use all rows as data
        : rows; // When not ignoring headers but format doesn't match, use all rows

    const nodes: GraphNode[] = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.length < 2) {
        throw new Error(`Row ${i + 1}: Missing required columns (id, name)`);
      }
      
      const id = row[0].trim();
      const name = row[1].trim();
      
      if (!id || !name) {
        throw new Error(`Row ${i + 1}: Both id and name must be non-empty`);
      }
      
      // Check for duplicate IDs
      if (nodes.some(node => node.id === id)) {
        throw new Error(`Row ${i + 1}: Duplicate node ID: ${id}`);
      }
      
      nodes.push({ id, name });
    }

    return nodes;
  }

  /**
   * Parse dependencies CSV
   * Expected format: upstream_relation_id,downstream_relation_id[,color_weight]
   */
  static parseDependencies(csvContent: string, ignoreHeaders: boolean = false): GraphDependency[] {
    const rows = this.parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Check if header exists and matches expected format
    const header = rows[0];
    
    // Determine if color weight column exists
    let hasColorWeight: boolean;
    if (ignoreHeaders) {
      // When ignoring headers, check if any row has 3+ columns
      hasColorWeight = rows.some(row => row.length >= 3);
      console.log('🔍 CSV DEBUG: ignoreHeaders=true, checking if any row has 3+ columns:', hasColorWeight);
      console.log('🔍 CSV DEBUG: All rows:', rows);
    } else {
      // When not ignoring headers, check header name
      hasColorWeight = header.length >= 3 && 
        (header[2].toLowerCase().includes('color') || header[2].toLowerCase().includes('weight'));
      console.log('🔍 CSV DEBUG: ignoreHeaders=false, checking header name:', hasColorWeight);
    }
    
    if (header.length < 2) {
      throw new Error('Dependencies CSV must have at least 2 columns: upstream_relation_id, downstream_relation_id');
    }

    // Skip header row if it matches expected format (unless ignoreHeaders is true)
    const dataRows = !ignoreHeaders && header[0].toLowerCase().includes('upstream') && header[1].toLowerCase().includes('downstream')
      ? rows.slice(1) 
      : ignoreHeaders 
        ? rows // When ignoring headers, use all rows as data
        : rows; // When not ignoring headers but format doesn't match, use all rows

    const dependencies: GraphDependency[] = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.length < 2) {
        throw new Error(`Row ${i + 1}: Missing required columns (upstream_relation_id, downstream_relation_id)`);
      }
      
      const upstream_relation_id = row[0].trim();
      const downstream_relation_id = row[1].trim();
      
      if (!upstream_relation_id || !downstream_relation_id) {
        throw new Error(`Row ${i + 1}: Both upstream_relation_id and downstream_relation_id must be non-empty`);
      }
      
      const dependency: GraphDependency = { upstream_relation_id, downstream_relation_id };
      
      // Parse color weight if present
      console.log(`🔍 CSV DEBUG: Processing row ${i + 1}:`, row);
      console.log(`🔍 CSV DEBUG: hasColorWeight=${hasColorWeight}, row.length=${row.length}, row[2]="${row[2]}"`);
      
      if (hasColorWeight && row.length >= 3 && row[2].trim()) {
        const weightStr = row[2].trim();
        const weight = parseFloat(weightStr);
        
        if (isNaN(weight)) {
          throw new Error(`Row ${i + 1}: Invalid color_weight value "${weightStr}". Must be a number between 0 and 1.`);
        }
        
        if (weight < 0 || weight > 1) {
          throw new Error(`Row ${i + 1}: color_weight must be between 0 and 1, got ${weight}.`);
        }
        
        dependency.color_weight = weight;
        console.log(`🔍 CSV DEBUG: ✅ Added color_weight: ${weight}`);
      } else {
        console.log(`🔍 CSV DEBUG: ❌ No color_weight added`);
      }
      
      dependencies.push(dependency);
    }

    return dependencies;
  }

  /**
   * Parse both CSV files and return combined data
   */
  static parseGraphData(nodeDefinitionsCSV: string, dependenciesCSV: string, ignoreHeaders: boolean = false): ParsedGraphData {
    const nodes = this.parseNodeDefinitions(nodeDefinitionsCSV, ignoreHeaders);
    const dependencies = this.parseDependencies(dependenciesCSV, ignoreHeaders);

    // Validate that all referenced node IDs in dependencies exist in nodes
    const nodeIds = new Set(nodes.map(node => node.id));
    
    for (const dep of dependencies) {
      if (!nodeIds.has(dep.upstream_relation_id)) {
        throw new Error(`Dependency references non-existent upstream node: ${dep.upstream_relation_id}`);
      }
      if (!nodeIds.has(dep.downstream_relation_id)) {
        throw new Error(`Dependency references non-existent downstream node: ${dep.downstream_relation_id}`);
      }
    }

    return { nodes, dependencies };
  }
}
