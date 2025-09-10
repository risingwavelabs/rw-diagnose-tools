import fs from 'fs';
import path from 'path';

// Mock the CSV parser for validation
class CSVParser {
  static parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    return lines.map(line => {
      return line.split(',').map(field => field.trim());
    });
  }

  static parseNodeDefinitions(csvContent) {
    const rows = this.parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    const header = rows[0];
    const dataRows = header[0].toLowerCase() === 'id' && header[1].toLowerCase() === 'name' 
      ? rows.slice(1) 
      : rows;

    const nodes = [];
    
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
      
      if (nodes.some(node => node.id === id)) {
        throw new Error(`Row ${i + 1}: Duplicate node ID: ${id}`);
      }
      
      nodes.push({ id, name });
    }

    return nodes;
  }

  static parseDependencies(csvContent) {
    const rows = this.parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    const header = rows[0];
    const dataRows = header[0].toLowerCase().includes('upstream') && header[1].toLowerCase().includes('downstream')
      ? rows.slice(1) 
      : rows;

    const dependencies = [];
    
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

  static parseGraphData(nodeDefinitionsCSV, dependenciesCSV) {
    const nodes = this.parseNodeDefinitions(nodeDefinitionsCSV);
    const dependencies = this.parseDependencies(dependenciesCSV);

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

// Test all CSV file pairs
const testCases = [
  'simple_graph',
  'complex_graph', 
  'dag',
  'parallel',
  'etl_pipeline',
  'error_test'
];

console.log('🧪 Validating Test CSV Files...\n');

let allPassed = true;

for (const testCase of testCases) {
  try {
    const nodesFile = `${testCase}_nodes.csv`;
    const dependenciesFile = `${testCase}_dependencies.csv`;
    
    console.log(`Testing ${testCase}...`);
    
    const nodesCSV = fs.readFileSync(nodesFile, 'utf8');
    const dependenciesCSV = fs.readFileSync(dependenciesFile, 'utf8');
    
    const result = CSVParser.parseGraphData(nodesCSV, dependenciesCSV);
    
    console.log(`  ✅ ${testCase}: ${result.nodes.length} nodes, ${result.dependencies.length} dependencies`);
    
  } catch (error) {
    if (testCase === 'error_test') {
      console.log(`  ✅ ${testCase}: Expected error caught - ${error.message}`);
    } else {
      console.log(`  ❌ ${testCase}: ${error.message}`);
      allPassed = false;
    }
  }
}

console.log('\n' + (allPassed ? '🎉 All test files validated successfully!' : '⚠️  Some test files have issues.'));
