export interface GraphNode {
  id: string;
  name: string;
}

export interface GraphDependency {
  upstream_relation_id: string;
  downstream_relation_id: string;
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
  static parseNodeDefinitions(csvContent: string): GraphNode[] {
    const rows = this.parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Check if header exists and matches expected format
    const header = rows[0];
    const expectedHeaders = ['id', 'name'];
    
    if (header.length < 2) {
      throw new Error('Node definitions CSV must have at least 2 columns: id, name');
    }

    // Skip header row if it matches expected format
    const dataRows = header[0].toLowerCase() === 'id' && header[1].toLowerCase() === 'name' 
      ? rows.slice(1) 
      : rows;

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
   * Expected format: upstream_relation_id,downstream_relation_id
   */
  static parseDependencies(csvContent: string): GraphDependency[] {
    const rows = this.parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Check if header exists and matches expected format
    const header = rows[0];
    const expectedHeaders = ['upstream_relation_id', 'downstream_relation_id'];
    
    if (header.length < 2) {
      throw new Error('Dependencies CSV must have at least 2 columns: upstream_relation_id, downstream_relation_id');
    }

    // Skip header row if it matches expected format
    const dataRows = header[0].toLowerCase().includes('upstream') && header[1].toLowerCase().includes('downstream')
      ? rows.slice(1) 
      : rows;

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
      
      dependencies.push({ upstream_relation_id, downstream_relation_id });
    }

    return dependencies;
  }

  /**
   * Parse both CSV files and return combined data
   */
  static parseGraphData(nodeDefinitionsCSV: string, dependenciesCSV: string): ParsedGraphData {
    const nodes = this.parseNodeDefinitions(nodeDefinitionsCSV);
    const dependencies = this.parseDependencies(dependenciesCSV);

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
