# rw-diagnose-tools
Toolset for diagnosing RisingWave clusters.

## Features

### Await-Tree Bottleneck Analyzer (Web UI)

This tool provides a web-based interface to analyze RisingWave await-tree dumps (in text or JSON format).

- **Functionality**: Identifies potential performance bottlenecks in actors based on:
    - **Slow Parent / Fast Children**: Detects spans that are significantly slower than their children.
    - **IO Bound Spans**: Detects slow spans related to storage I/O operations (`store_*`, `fetch_block`).
- **Technology**: Built with React, TypeScript, and Rust compiled to WebAssembly (WASM), allowing analysis directly in the browser.
- **Deployment**: Hosted as a static web page on GitHub Pages.

## Local Development (Await-Tree Analyzer Web UI)

To run the web-based analyzer locally:

1.  **Prerequisites**:
    *   Install Rust: <https://www.rust-lang.org/tools/install>
    *   Install `wasm-pack`: `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`
    *   Install Node.js (which includes npm): <https://nodejs.org/> (Version 18+ recommended)

2.  **Install Dependencies**:
    Navigate to the `web/` directory and install Node.js dependencies:
    ```bash
    cd web
    npm install
    cd ..
    ```

3.  **Run Development Server**:
    From the `web/` directory, start the Vite development server:
    ```bash
    cd web
    npm run dev
    ```
    This command will first build the WASM package (`public/pkg`) and then start the Vite server (usually on `http://localhost:5173`). Open the provided URL in your browser.

4.  **Usage**:
    Use the file input on the page to upload your await-tree dump file. The analysis results will be displayed below.

## Building for Production

To create a production build (static files):

1.  Navigate to the `web/` directory.
2.  Run the build command:
    ```bash
    cd web
    npm run build
    ```
    This will build the WASM package and then build the React application into the `web/dist` directory.
    These are the files deployed by the GitHub Actions workflow.
