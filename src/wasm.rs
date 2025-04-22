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

use crate::await_tree::utils::extract_actor_traces;
use crate::await_tree::AnalyzeSummary;
use anyhow::Context;
use wasm_bindgen::prelude::*;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

fn from_file_content(content: &str) -> anyhow::Result<String> {
    let actor_traces = extract_actor_traces(content)
        .map_err(|e| anyhow::anyhow!("Failed to extract actor traces from file: {}", e))?;
    
    web_sys::console::log_1(&format!("actor_traces: {:#?}", actor_traces).into());
    
    Ok(AnalyzeSummary::from_traces(&actor_traces)
        .context("Failed to analyze traces")?
        .to_string())
}

/// Analyzes the await-tree dump provided as a string.
/// Returns a string containing the analysis summary or an error message.
#[wasm_bindgen]
pub fn analyze_dump_str(dump_content: &str) -> String {
    // Set the panic hook for better error messages in the browser console.
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    from_file_content(dump_content).unwrap_or_else(|e| format!("Error analyzing traces: {}", e))
}
