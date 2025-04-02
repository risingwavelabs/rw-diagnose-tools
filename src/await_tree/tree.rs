// Copyright 2025 RisingWave Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use std::fmt::Write;

use itertools::Itertools;
use serde::Deserialize;
use std::str::FromStr;

/// See <https://github.com/risingwavelabs/await-tree/blob/main/src/context.rs> for the original definition.
/// This is for loading await tree info from the JSON output of `Tree`.
#[derive(Debug, Clone, Deserialize)]
pub struct TreeView {
    /// ID of the currently active span
    pub(crate) current: usize,

    /// The root span tree
    pub(crate) tree: SpanNodeView,

    /// Detached subtrees
    pub(crate) detached: Vec<SpanNodeView>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct SpanNodeView {
    /// Unique identifier in the arena
    pub id: usize,

    /// Span metadata
    pub span: SpanView,

    /// Elapsed time in nanoseconds
    pub elapsed_ns: u128,

    /// Recursive children
    pub children: Vec<SpanNodeView>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct SpanView {
    /// Span name (likely String or interned)
    pub name: String,

    /// Whether this span is verbose
    #[allow(dead_code)]
    pub is_verbose: bool,

    /// Whether this span is long-running
    pub is_long_running: bool,
}

impl std::fmt::Display for TreeView {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        fn fmt_node(
            f: &mut std::fmt::Formatter<'_>,
            node: &SpanNodeView,
            depth: usize,
            current_id: usize,
        ) -> std::fmt::Result {
            // Indentation
            f.write_str(&" ".repeat(depth * 2))?;

            // Span name
            f.write_str(&node.span.name)?;

            // Elapsed time
            let elapsed_secs = node.elapsed_ns as f64 / 1_000_000_000.0;
            write!(
                f,
                " [{}{:.3}s]",
                if !node.span.is_long_running && elapsed_secs >= 10.0 {
                    "!!! "
                } else {
                    ""
                },
                elapsed_secs
            )?;

            // Current span marker
            if depth > 0 && node.id == current_id {
                f.write_str("  <== current")?;
            }

            f.write_char('\n')?;

            // Format children recursively
            for child in node.children.iter().sorted_by_key(|n| n.elapsed_ns) {
                fmt_node(f, child, depth + 1, current_id)?;
            }

            Ok(())
        }
        // Format the main tree
        fmt_node(f, &self.tree, 0, self.current)?;

        // Format detached spans
        for node in &self.detached {
            writeln!(f, "[Detached {}]", node.id)?;
            fmt_node(f, node, 1, self.current)?;
        }

        Ok(())
    }
}

/// The process of converting the tree to text is not lossless—information such as
/// `node_id` will be lost. Consequently, this function can only restore information
/// to the best extent possible. Fields like `current` and `node_id` cannot be
/// recovered, but this loss does not affect our bottleneck detection. In the
/// function, we will set all `node_id` values to 0 and `current` to 100.
impl FromStr for TreeView {
    type Err = &'static str;

    fn from_str(input: &str) -> Result<Self, Self::Err> {
        let mut tree: Option<SpanNodeView> = None;
        let mut detached: Vec<SpanNodeView> = Vec::new();
        let mut node_stack: Vec<(usize, SpanNodeView)> = Vec::new();

        for line in input.lines() {
            let mut line = line.trim_end(); // Remove trailing spaces

            // Check for detached span
            if line.starts_with("[Detached ") {
                if let Some((_, node)) = node_stack.pop() {
                    detached.push(node);
                }
                continue;
            }

            if let Some(stripped) = line.strip_suffix("<== current") {
                line = stripped.trim_end(); // Remove and trim again
            }

            // Check for span definition line
            if let Some((span_name, rest)) = line.split_once('[') {
                let name = span_name.trim().to_owned();

                // Extract elapsed time from the format `[elapsed_ns]`
                if let Some(elapsed_str) = rest.strip_suffix(']') {
                    let elapsed_ns = parse_elapsed_ns(elapsed_str.trim());
                    let is_long_running =
                        elapsed_ns >= 10_000_000_000 && !elapsed_str.starts_with("!!!");

                    let span_view = SpanView {
                        name,
                        is_verbose: false,
                        is_long_running,
                    };

                    let id = node_stack.len();
                    let new_node = SpanNodeView {
                        id: 0, // id cannot be recovered, we set it to 0
                        span: span_view,
                        elapsed_ns,
                        children: Vec::new(),
                    };

                    // Determine the depth of the current line (2 spaces per depth level)
                    let depth = line.chars().take_while(|&c| c == ' ').count() / 2;

                    if depth == 0 {
                        // Root span
                        if let Some((_, root)) = node_stack.pop() {
                            detached.push(root);
                        }
                        node_stack.push((id, new_node));
                    } else {
                        // Check if the depth decreased, pop stack if necessary
                        while node_stack.len() > depth {
                            let (_, node) = node_stack.pop().unwrap();
                            if let Some((_, parent)) = node_stack.last_mut() {
                                parent.children.push(node);
                            }
                        }

                        // Push the new node onto the stack
                        node_stack.push((id, new_node));
                    }
                }
            }
        }

        // Properly build the tree by attaching remaining nodes to their parents
        while let Some((_, node)) = node_stack.pop() {
            if let Some((_, parent)) = node_stack.last_mut() {
                parent.children.push(node);
            } else {
                tree = Some(node); // The last node in the stack is the root
            }
        }

        if tree.is_none() {
            return Err("Failed to parse tree view");
        }

        Ok(TreeView {
            current: usize::MAX, // Always set to an unreachable number
            tree: tree.unwrap(),
            detached,
        })
    }
}

/// Parses the elapsed time in nanoseconds from a string.
///
/// # Example Input:
/// - "123456789ns"
/// - "!!! 12.345s"
fn parse_elapsed_ns(s: &str) -> u128 {
    if s.starts_with("!!!") {
        let s = s.trim_start_matches("!!!").trim();
        parse_time_str(s)
    } else {
        parse_time_str(s)
    }
}

/// Converts a formatted time string to nanoseconds.
///
/// # Supported Formats:
/// - "12.345s" → 12,345,000,000 ns
/// - "123ms" → 123,000,000 ns
/// - "456789ns" → 456,789 ns
fn parse_time_str(s: &str) -> u128 {
    if let Some(ms) = s.strip_suffix("ms") {
        ms.parse::<f64>().unwrap_or(0.0) as u128 * 1_000_000
    } else if let Some(ns) = s.strip_suffix("ns") {
        ns.parse::<u128>().unwrap_or(0)
    } else if let Some(s) = s.strip_suffix('s') {
        (s.parse::<f64>().unwrap_or(0.0) * 1_000_000_000.0) as u128
    } else {
        0
    }
}

#[cfg(test)]
mod tests {
    use anyhow::Result;
    use std::str::FromStr;

    use crate::await_tree::TreeView;

    #[test]
    fn test_parse_tree_view_from_text_1() -> Result<()> {
        let input = r#"Actor 132: `mv` [21.285s]
  Epoch 8251479171792896 [!!! 21.283s]
    Materialize 8400000007 [!!! 21.283s]
      Project 8400000006 [!!! 21.280s]
        HashAgg 8400000005 [!!! 21.280s]
          Merge 8400000004 [0.001s]  <== current
"#;
        let res = TreeView::from_str(input);
        assert!(res.is_ok());
        let tree_view = res.unwrap();

        let expected = r#"Actor 132: `mv` [21.285s]
  Epoch 8251479171792896 [!!! 21.283s]
    Materialize 8400000007 [!!! 21.283s]
      Project 8400000006 [!!! 21.280s]
        HashAgg 8400000005 [!!! 21.280s]
          Merge 8400000004 [0.001s]
"#;
        assert_eq!(tree_view.to_string(), expected);
        Ok(())
    }

    #[test]
    fn test_parse_tree_view_from_text_2() -> Result<()> {
        let input = r#"Actor 132: `mv` [21.285s]
  Epoch 8251479171792896 [!!! 21.283s]
    Materialize 8400000007 [!!! 21.283s]
      Project 8400000006 [!!! 21.280s]
        HashAgg 8400000005 [!!! 21.280s]
          Merge 8400000004 [0.001s]  <== current
        HashAgg 8400000005 [!!! 21.380s]
"#;
        let res = TreeView::from_str(input);
        assert!(res.is_ok());
        let tree_view = res.unwrap();

        let expected = r#"Actor 132: `mv` [21.285s]
  Epoch 8251479171792896 [!!! 21.283s]
    Materialize 8400000007 [!!! 21.283s]
      Project 8400000006 [!!! 21.280s]
        HashAgg 8400000005 [!!! 21.280s]
          Merge 8400000004 [0.001s]
        HashAgg 8400000005 [!!! 21.380s]
"#;
        assert_eq!(tree_view.to_string(), expected);
        Ok(())
    }
}
