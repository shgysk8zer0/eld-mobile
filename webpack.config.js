const webpack = require('webpack');
const path = require('path');

module.exports = {
    entry: './js/index.js',
    output: {
        path: __dirname,
        filename: 'js/index.min.js'
    },
		optimization: {
			minimize: true
		},
		mode: "production",
		module: {
		  rules: [
		    {
		      test: /\.js$/,
		      exclude: /(node_modules|bower_components)/,
		      use: {
		        loader: 'babel-loader',
		        options: {
		          presets: ['@babel/preset-env'],
							plugins: ['@babel/transform-runtime']
		        }
		      }
		    }
		  ]
		},
    plugins: [
        // Avoid publishing files when compilation fails
        new webpack.NoEmitOnErrorsPlugin(),
    ],
    stats: {
        // Nice colored output
        colors: true
    },
    // Create Sourcemaps for the bundle
    devtool: 'source-map'
};
