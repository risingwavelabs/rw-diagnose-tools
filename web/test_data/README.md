# Test CSV Files for Graph Visualizer

This directory contains various test CSV files to verify the graph visualization functionality. Each test case demonstrates different graph structures and scenarios.

## Test Cases

### 1. Simple Graph (`simple_graph_*`)
- **Purpose**: Basic linear graph with 3 nodes
- **Structure**: A → B → C
- **Use Case**: Testing basic functionality and simple linear workflows

### 2. Complex Graph (`complex_graph_*`)
- **Purpose**: Multi-source, multi-output analytics pipeline
- **Structure**: Two data sources feeding into filters, joins, aggregations, and multiple outputs
- **Use Case**: Testing complex data processing pipelines with multiple branches

### 3. DAG (Directed Acyclic Graph) (`dag_*`)
- **Purpose**: Machine learning pipeline with sequential steps
- **Structure**: Linear pipeline from data input to model deployment and monitoring
- **Use Case**: Testing ML/AI workflow visualization

### 4. Parallel Processing (`parallel_*`)
- **Purpose**: Fan-out/fan-in pattern with parallel tasks
- **Structure**: One start node → 4 parallel tasks → merge → end
- **Use Case**: Testing parallel processing workflows

### 5. ETL Pipeline (`etl_pipeline_*`)
- **Purpose**: Extract, Transform, Load pipeline with monitoring
- **Structure**: Multiple data sources → extraction → transformation → multiple loads → monitoring
- **Use Case**: Testing data engineering pipelines

### 6. Error Test (`error_test_*`)
- **Purpose**: Testing error handling with invalid references
- **Structure**: Valid nodes with one dependency referencing a non-existent node
- **Use Case**: Testing validation and error reporting

## File Formats

### Node Definitions CSV
```csv
id,name
node_id,Node Display Name
```

### Dependencies CSV
```csv
upstream_relation_id,downstream_relation_id
source_node_id,target_node_id
```

## Usage Instructions

1. Navigate to the Graph Visualizer page in the web application
2. Upload the corresponding `*_nodes.csv` file as "Node Definitions CSV"
3. Upload the corresponding `*_dependencies.csv` file as "Dependencies CSV"
4. Click "Parse and Visualize Graph" to see the visualization

## Expected Results

- **Simple Graph**: Should show a linear chain of 3 nodes
- **Complex Graph**: Should show a complex network with multiple branches and convergence points
- **DAG**: Should show a linear pipeline with 9 sequential steps
- **Parallel**: Should show a diamond pattern with 4 parallel branches
- **ETL Pipeline**: Should show a complex network with multiple data flows
- **Error Test**: Should display an error message about the non-existent node reference

## Testing Scenarios

1. **Basic Functionality**: Use simple_graph files
2. **Complex Visualization**: Use complex_graph files
3. **Performance**: Use etl_pipeline files (largest graph)
4. **Error Handling**: Use error_test files
5. **Different Patterns**: Try parallel and dag files to see different graph structures
