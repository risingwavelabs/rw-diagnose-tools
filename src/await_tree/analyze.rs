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

use std::collections::HashMap;
use std::fmt::{Display, Formatter};

use crate::await_tree::tree::TreeView;
use crate::await_tree::utils::extract_actor_traces;
use crate::await_tree::utils::parse_tree_from_trace;

#[derive(Debug, Clone)]
pub struct AnalyzeSummary {
    has_fast_children_actors: HashMap<u32, TreeView>,
    /// IO bound rule usually match a lot of Trees once the storage is unavailable, as a
    /// result, too many trees are outputed. We only output the actor ids here.
    io_bound_actors: Vec<u32>,
}

impl AnalyzeSummary {
    pub fn new() -> Self {
        Self {
            has_fast_children_actors: HashMap::new(),
            io_bound_actors: Vec::new(),
        }
    }

    pub fn from_traces<'a, M>(actor_traces: M) -> anyhow::Result<Self>
    where
        M: IntoIterator<Item = (&'a u32, &'a String)>,
    {
        let mut summary = Self::new();
        for (actor_id, trace) in actor_traces {
            let tree = parse_tree_from_trace(trace)?;
            if tree.has_fast_children() {
                summary.has_fast_children_actors.insert(*actor_id, tree);
            } else if tree.is_io_bound() {
                summary.io_bound_actors.push(*actor_id);
            }
        }
        Ok(summary)
    }

    pub fn add_fast_children_actor(&mut self, actor_id: u32, tree: TreeView) {
        self.has_fast_children_actors.insert(actor_id, tree);
    }

    pub fn add_io_bound_actor(&mut self, actor_id: u32) {
        self.io_bound_actors.push(actor_id);
    }

    pub fn merge_other(&mut self, b: &AnalyzeSummary) {
        self.has_fast_children_actors
            .extend(b.has_fast_children_actors.clone());
        self.io_bound_actors.extend(b.io_bound_actors.clone());
    }
}

impl Default for AnalyzeSummary {
    fn default() -> Self {
        Self::new()
    }
}

impl Display for AnalyzeSummary {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        writeln!(f, "Analyze Summary:")?;
        let mut bottleneck_actors_found = false;

        if !self.has_fast_children_actors.is_empty() {
            writeln!(f, "Fast Children Actors:")?;
            for (actor_id, tree) in &self.has_fast_children_actors {
                writeln!(f, ">> Actor {}", actor_id)?;
                writeln!(f, "{}", tree)?;
            }
            bottleneck_actors_found = true;
        }
        if !self.io_bound_actors.is_empty() {
            writeln!(f, "IO Bound Actors:")?;
            let mut sorted_io_bound_actors = self.io_bound_actors.clone();
            sorted_io_bound_actors.sort_unstable();
            writeln!(f, "{:?}", sorted_io_bound_actors)?;
            bottleneck_actors_found = true;
        }

        if !bottleneck_actors_found {
            writeln!(f, "No bottleneck actors detected.")?;
        }
        Ok(())
    }
}

impl TreeView {
    /// The target of this function is to analyze whether the current tree is the
    /// bottleneck.
    ///
    pub fn is_bottleneck(&self) -> bool {
        self.has_fast_children() || self.is_io_bound()
    }

    /// This function checks if the tree contains the characteristic bottleneck pattern:
    /// a slow parent span node whose children are comparatively fast.
    ///
    /// We assume there are three types of trees regarding the status in a stuck graph:
    ///
    /// - Input Blocking Tree, IB Tree
    /// - Output Blocking Tree, OB Tree
    /// - Bottleneck Tree, BN Tree
    ///
    /// Each Tree here maps to a specific actor and fragment of a streaming graph.
    /// The diagram below shows the logical structure of a stuck streaming graph:
    /// -------------------------------------------------------------------------------
    ///    OB(Source Executor)  ->  OB  ->  BN  ->  IB  ->  IB(Materialize Executor)
    /// -------------------------------------------------------------------------------
    ///   |   waiting for new epcoh   | bottleneck |      Waiting for input         |
    /// -------------------------------------------------------------------------------
    ///
    /// A typical look of OB Tree/IB Tree:
    /// ```text
    /// Actor 123456: `XXXXX` [1595.653s]
    ///   Epoch 7509626714259456 [!!! 1582.513s]
    ///     CdcFilter 1DFBC0000271D [!!! 1582.423s]
    ///       Merge 1DFBC00000000 [!!! 1582.423s]
    ///         LocalInput (actor 122807) [!!! 1582.423s]
    /// ```
    /// Note:
    /// For an OB Tree, all the executors in the tree are waiting for source.
    /// However, the source executor is also blocked by barrier collection.
    /// For an IB Tree, all the executors in the tree are waiting for the input data from
    /// the bottleneck executor, which is the upstream of the IB Tree.
    ///
    /// A typical look of BN Tree:
    /// ```text
    /// Actor 123456: `XXXXX` [1595.673s]
    ///   Epoch 7509625856917504 [!!! 1590.993s]
    ///     Materialize 9E2000000000D [!!! 1590.993s]
    ///       Project 9E2000000000C [!!! 1590.993s]
    ///         Project 9E2000000000B [!!! 1590.993s]
    ///           Project 9E2000000000A [!!! 1590.993s]
    ///             HashAgg 9E20000000009 [!!! 1590.993s] <== Bottleneck
    ///               Merge 9E20000000008 [980.020ms]
    ///                 LocalInput (actor 647685) [980.020ms]
    /// ```
    /// Note:
    /// There is usually a bottleneck executor throttling the whole graph. So we can
    /// detect the bottleneck by checking the elapsed time of the bottleneck executor
    /// and the average elapsed time of its children. If the elapsed time of the
    /// bottleneck executor is much larger than (eg, 5x) the average elapsed time of its
    /// children, we can say that the bottleneck executor is the bottleneck of the graph.
    ///
    /// A special look of IB Tree:
    /// ```text
    /// Actor 123456: `XXXXX` [1595.653s]
    ///   Epoch 7509625856917504 [!!! 1591.003s]
    ///     Union 9E20200000007 [1.000s]
    ///       Merge 9E20200000003 [1.000s]
    ///         LocalInput (actor 647689) [1.000s]
    /// ```
    /// Note:
    /// In this case, although the bottleneck actor(BN Tree) throttles the whole graph,
    /// the bottleneck actor is still yielding output to downstream actors. A typical
    /// case is JOIN amplification. So the corresponding actors are actively processing
    /// the data but the EPOCH span is blocked.
    pub(crate) fn has_fast_children(&self) -> bool {
        self.tree.visit(&|node| {
            let elapsed_secs = node.elapsed_ns as f64 / 1_000_000_000.0;
            let slow_span = !node.span.is_long_running && elapsed_secs >= 10.0;
            let is_epoch = node.span.name.starts_with("Epoch");

            if !is_epoch && !node.children.is_empty() {
                // IB Tree's `Epoch` span may have a long elapsed time, though it's not
                // a bottleneck. We exclude the `Epoch` span from the bottleneck detection
                let mut elapsed_sum = 0.;
                let mut elapsed_count = 0;
                for child in &node.children {
                    elapsed_count += 1;
                    elapsed_sum += child.elapsed_ns as f64 / 1_000_000_000.0;
                }
                let elapsed_avg = elapsed_sum / elapsed_count as f64;
                if slow_span && (elapsed_avg * 5.0 < elapsed_secs) {
                    return true;
                }
            }
            false
        })
    }

    /// This function checks if the tree contains the characteristic bottleneck pattern:
    /// the tree is blocked by `store_flush` or `store_get`.
    /// TODO(kexiang): Can we generalize it as: if a leaf span is slow and it is not one
    /// of the following types—Merge, LocalOutput, LocalInput, RemoteOutput, or
    /// RemoteInput—then, we can conclude that it is the bottleneck?
    pub(crate) fn is_io_bound(&self) -> bool {
        self.tree.visit(&|node| {
            let elapsed_secs = node.elapsed_ns as f64 / 1_000_000_000.0;
            let slow_span = !node.span.is_long_running && elapsed_secs >= 10.0;
            let is_io_operation = node.span.name == "store_flush" || node.span.name == "store_get";

            if is_io_operation && slow_span {
                return true;
            }
            false
        })
    }
}

pub fn bottleneck_detect_from_file(path: &str) -> anyhow::Result<AnalyzeSummary> {
    let actor_traces = extract_actor_traces(path)
        .map_err(|e| anyhow::anyhow!("Failed to extract actor traces from file: {}", e))?;
    AnalyzeSummary::from_traces(&actor_traces)
}
