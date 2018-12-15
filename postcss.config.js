module.exports = {
	map: {
		inline: false,
	},
	plugins: [
		require('postcss-preset-env'),
		require('postcss-import'),
		require('postcss-discard-comments'),
		require('cssnano'),
	]
}
