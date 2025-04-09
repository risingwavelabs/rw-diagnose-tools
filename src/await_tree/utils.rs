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
use std::fs::File;
use std::io::{self, BufRead};
use std::path::Path;
use std::str::FromStr;

use crate::await_tree::tree::TreeView;

/// Check `impl Display for StackTraceResponseOutput<'_>` for the format of the file.
pub(crate) fn extract_actor_traces<P: AsRef<Path>>(
    path: P,
) -> anyhow::Result<HashMap<u32, String>> {
    let file = File::open(path)?;
    let reader = io::BufReader::new(file);

    let mut actor_traces = HashMap::new();
    let mut in_actor_traces = false;
    let mut current_actor_id = None;
    let mut current_trace = String::new();

    for line in reader.lines() {
        let line = line?;

        // Detect the start of the Actor Traces section
        if line == "--- Actor Traces ---" || line.starts_with("Await-Tree Dump of ") {
            // disgnose file use `--- Actor Traces ---` as the header
            // meta dashboard's await-tree dump use `Await-Tree Dump of ` as the header
            in_actor_traces = true;
            continue;
        }

        // Stop parsing if a new section is encountered
        if (line.starts_with("---")
            || line.starts_with("[RPC")
            || line.starts_with("[Compaction")
            || line.starts_with("[Barrier")
            || line.starts_with("[JVM"))
            && in_actor_traces
        {
            // disgnose file use `---` to separate sections
            // in meta dashboard's await-tree dump, `[XXXX` means the start of a new section
            if let Some(actor_id) = current_actor_id {
                actor_traces.insert(actor_id, current_trace.trim().to_owned());
            }
            break;
        }

        // Parse Actor ID
        if in_actor_traces && (line.starts_with(">> Actor ") || line.starts_with("[Actor ")) {
            // Save the previous actor trace before processing the next one
            if let Some(actor_id) = current_actor_id {
                actor_traces.insert(actor_id, current_trace.trim().to_owned());
            }
            // Extract actor_id for both formats
            let id_str_opt = if let Some(id) = line.strip_prefix(">> Actor ") {
                Some(id.trim())
            } else if let Some(inner) = line.strip_prefix("[Actor ") {
                inner.strip_suffix(']').map(str::trim)
            } else {
                None
            };

            if let Some(id_str) = id_str_opt {
                if let Ok(actor_id) = id_str.trim().parse::<u32>() {
                    current_actor_id = Some(actor_id);
                    current_trace.clear(); // Clear trace for the next actor
                }
            }
        } else if in_actor_traces {
            // Accumulate trace content for the current actor
            current_trace.push_str(&line);
            current_trace.push('\n');
        }
    }

    // Store the last actor's trace if any
    if let Some(actor_id) = current_actor_id {
        actor_traces.insert(actor_id, current_trace.trim().to_owned());
    }

    Ok(actor_traces)
}

pub(crate) fn parse_tree_from_trace(trace: &str) -> anyhow::Result<TreeView> {
    if trace.trim().starts_with("{") {
        // JSON usually starts with `{`
        serde_json::from_str(&trace)
            .map_err(|e| anyhow::anyhow!("Failed to parse actor trace JSON: {}", e))
    } else {
        TreeView::from_str(&trace)
            .map_err(|e| anyhow::anyhow!("Failed to parse actor trace text: {}", e))
    }
}
