/*
 Custom Babel config to make @wordpress/docgen work, without
 affecting the Babel config detection in @wordpress/scripts, which doesn't look
 for this file type. See https://github.com/WordPress/gutenberg/blob/e299c1fbc6edf6e5c571dfc8fc4f823828232094/packages/scripts/utils/config.js#L26-L33
 and https://github.com/WordPress/gutenberg/blob/e299c1fbc6edf6e5c571dfc8fc4f823828232094/packages/scripts/config/webpack.config.js#L189-L205.
 */
module.exports = ( api ) => {
	api.cache( true );

	return {
		presets: [ '@wordpress/babel-preset-default' ],
		plugins: [ [ 'babel-plugin-react-compiler', { target: '18' } ] ],
	};
};
