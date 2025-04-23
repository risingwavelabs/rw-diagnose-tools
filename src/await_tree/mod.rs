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

//! Await-Tree Dump format
//!
//! <https://github.com/risingwavelabs/risingwave/blob/0aae97855991527ef024ddf6fda1529d81130d78/dashboard/pages/await_tree.tsx#L59-L76>
//!
//! ```text
//! Await-Tree Dump of All Compute Nodes:
//!
//! [Actor 1]
//! Actor 1: `<mv_name (release mode) or sql (debug_mode)>` [5.277s]
//!   Epoch 8397931225350144 [374.387ms]
//!     Source 100002712 [374.648ms]
//!       receive_barrier [374.648ms]
//! ```
//!
//! Diagnose report format
//!
//! Check `impl Display for StackTraceResponseOutput<'_>` for the format of the file.
//! <https://github.com/risingwavelabs/risingwave/blob/96d5238e55f91613f96f1f5d35fced0506882637/src/common/src/util/prost.rs#L43-L91>
//!
//! ```text
//! --- Actor Traces ---
//! >> Actor 1
//! Actor 1: `<mv_name (release mode) or sql (debug_mode)>` [46.013s]
//!   Epoch 8397933912391680 [112.048ms]
//!     Source 100002712 [112.322ms]
//!       receive_barrier [112.316ms]
//! ```

mod analyze;
mod transcribe;
mod tree;
pub(crate) mod utils;

pub use analyze::*;
pub use transcribe::*;
pub use tree::*;
