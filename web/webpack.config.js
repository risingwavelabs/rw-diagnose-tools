import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (env, argv) => {
    const isProduction = argv.mode === 'production';
    // Determine public path based on environment
    const publicPath = isProduction ? '/rw-diagnose-tools/' : '/';

    return {
        entry: './src/main.tsx', // Ensure you have src/main.tsx as the entry point
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: isProduction ? '[name].[contenthash].js' : '[name].bundle.js',
            clean: true, // Clean the output directory before build
            publicPath: publicPath, // Use the determined public path
        },
        module: {
            rules: [
                {
                    test: /\.(ts|tsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader', // Use babel-loader for TS/TSX
                        options: {
                            presets: [
                                '@babel/preset-env',
                                ['@babel/preset-react', { runtime: 'automatic' }], // Use automatic runtime for React 17+
                                '@babel/preset-typescript',
                            ],
                        },
                    },
                },
                {
                    test: /\.css$/i,
                    use: ['style-loader', 'css-loader', 'postcss-loader'], // Process CSS files with PostCSS
                },
                {
                    test: /\.(png|svg|jpg|jpeg|gif)$/i,
                    type: 'asset/resource', // Handle image assets
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'], // Resolve these extensions
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './index.html', // Use public/index.html as template
                filename: 'index.html',
                inject: 'body',
            }),
            // Add other plugins here if needed (e.g., DefinePlugin)
        ],
        devServer: {
            static: {
                directory: path.join(__dirname, 'dist'), // Serve from dist
            },
            historyApiFallback: true, // For single-page applications
            compress: true,
            port: 3000, // Or any other port
            hot: true, // Enable Hot Module Replacement
            open: true, // Open browser automatically
        },
        // Enable experiments for asyncWebAssembly (required for WASM)
        experiments: {
            asyncWebAssembly: true,
            // syncWebAssembly: true, // Avoid unless absolutely necessary
        },
        // Optional: Configure optimization for production builds
        optimization: {
            splitChunks: {
                chunks: 'all',
            },
        },
        // Provide source maps for debugging
        devtool: isProduction ? 'source-map' : 'eval-source-map',
    };
}; 