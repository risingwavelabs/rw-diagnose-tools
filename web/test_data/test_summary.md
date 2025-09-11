# Test CSV Files Summary

## Quick Reference

| Test Case | Nodes | Dependencies | Graph Type | Purpose |
|-----------|-------|--------------|------------|---------|
| `simple_graph` | 3 | 2 | Linear | Basic functionality test |
| `complex_graph` | 10 | 10 | Multi-branch | Analytics pipeline |
| `dag` | 9 | 8 | Sequential | ML pipeline |
| `parallel` | 7 | 9 | Fan-out/Fan-in | Parallel processing |
| `etl_pipeline` | 12 | 19 | Complex network | Data engineering |
| `error_test` | 3 | 3 | Invalid | Error handling |
| `color_weight` | 4 | 3 | Linear with colors | Color weight demonstration |
| `mixed_weights` | 5 | 4 | Multi-source with colors | Mixed weight values |

## Graph Visualizations You'll See

The graphs now use **Dagre** for professional hierarchical layout with multiple direction options:

### Layout Directions Available:
- **Top to Bottom (TB)**: Traditional hierarchical flow
- **Bottom to Top (BT)**: Reverse hierarchical flow  
- **Left to Right (LR)**: Horizontal flow
- **Right to Left (RL)**: Reverse horizontal flow

### Graph Examples:

#### Simple Graph (A→B→C)
```
A ──→ B ──→ C
```

#### Complex Graph (Analytics Pipeline)
```
source1 ──→ filter1 ──→ join1 ──→ agg1 ──→ sort1 ──→ output1
source2 ──→ filter2 ──→ join1 ──→ agg2 ──→ sort1 ──→ output2
```

#### DAG (ML Pipeline)
```
A → B → C → D → E → F → G → H → I
```

#### Parallel Processing
```
    task1 ──┐
start ──→ task2 ──→ merge ──→ end
    task3 ──┘
    task4 ──┘
```

#### ETL Pipeline
```
raw_data ──→ extract1 ──→ transform1 ──→ load1 ──┐
raw_data ──→ extract2 ──→ transform2 ──→ load2 ──→ monitor ──→ alert
raw_data ──→ extract3 ──→ transform3 ──→ load3 ──┘
```

## Testing Workflow

1. **Start with Simple**: Use `simple_graph` to verify basic functionality
2. **Test Complexity**: Use `complex_graph` to see multi-branch visualization
3. **Check Performance**: Use `etl_pipeline` (largest graph) to test rendering performance
4. **Verify Errors**: Use `error_test` to ensure proper error handling
5. **Explore Patterns**: Try `parallel` and `dag` to see different graph structures
6. **Test Color Weights**: Use `color_weight` and `mixed_weights` to see edge coloring

## File Locations

All test files are in `/web/test_data/`:
- `*_nodes.csv` - Node definitions
- `*_dependencies.csv` - Dependency relationships
- `README.md` - Detailed documentation
- `validate_test_files.js` - Validation script
