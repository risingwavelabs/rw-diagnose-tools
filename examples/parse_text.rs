// Copyright 2023 RisingWave Labs
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

//! This example shows the basic usage of `await-tree`.

use std::{str::FromStr, time::Duration};

use await_tree::{span, Config, InstrumentAwait, Registry};
use futures::future::{join, pending};
use rw_diagnose_tools::await_tree::TreeView;
use tokio::time::sleep;

async fn bar(i: i32) {
    // `&'static str` span
    baz(i).instrument_await("baz in bar").await
}

async fn baz(i: i32) {
    // runtime `String` span is also supported
    pending()
        .instrument_await(span!("pending in baz {i}"))
        .await
}

async fn foo() {
    // spans of joined futures will be siblings in the tree
    join(
        bar(3).instrument_await("bar"),
        baz(2).instrument_await("baz"),
    )
    .await;
}

#[tokio::main]
async fn main() {
    let registry = Registry::new(Config::default());
    let root = registry.register((), "foo");
    tokio::spawn(root.instrument(foo()));

    sleep(Duration::from_secs(1)).await;
    let tree_str = registry.get(()).unwrap().to_string();
    let tree_view = TreeView::from_str(&tree_str).unwrap();
    assert_eq!(tree_str, tree_view.to_string());
    // foo [1.006s]
    //   bar [1.006s]
    //     baz in bar [1.006s]
    //       pending in baz 3 [1.006s]
    //   baz [1.006s]
    //     pending in baz 2 [1.006s]
    println!("{tree_view}");
}
