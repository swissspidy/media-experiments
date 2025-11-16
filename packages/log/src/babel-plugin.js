/**
 * Internal dependencies
 */
const pkg = require( '../package.json' );

/**
 * Babel plugin which transforms `warning` function calls to wrap within a
 * condition that checks if `SCRIPT_DEBUG === true`.
 *
 * @param {import('@babel/core')} babel Current Babel object.
 *
 * @return {import('@babel/core').PluginObj} Babel plugin object.
 */
function babelPlugin( { types: t } ) {
	const seen = Symbol( 'seen' );

	const typeofProcessExpression = t.binaryExpression(
		'!==',
		t.unaryExpression( 'typeof', t.identifier( 'SCRIPT_DEBUG' ), false ),
		t.stringLiteral( 'undefined' )
	);

	const scriptDebugCheckExpression = t.binaryExpression(
		'===',
		t.identifier( 'SCRIPT_DEBUG' ),
		t.booleanLiteral( true )
	);

	const logicalExpression = t.logicalExpression(
		'&&',
		typeofProcessExpression,
		scriptDebugCheckExpression
	);

	return {
		visitor: {
			ImportDeclaration( path, state ) {
				const { node } = path;
				const isThisPackageImport =
					node.source.value.indexOf( pkg.name ) !== -1;

				if ( ! isThisPackageImport ) {
					return;
				}

				const importSpecifier = node.specifiers.find( ( specifier ) => {
					return specifier.type === 'ImportSpecifier';
				} );

				if ( importSpecifier?.local ) {
					const { name } = importSpecifier.local;
					state.callee = name;
				}
			},
			CallExpression( path, state ) {
				const { node } = path;

				// Ignore if it's already been processed.
				// @ts-ignore
				if ( node[ seen ] ) {
					return;
				}

				// @ts-ignore
				const name = state.callee || state.opts.callee;

				if ( path.get( 'callee' ).isIdentifier( { name } ) ) {
					// Turns this code:
					// warning(argument);
					// into this:
					// typeof SCRIPT_DEBUG !== 'undefined' && SCRIPT_DEBUG === true ? warning(argument) : void 0;
					// @ts-ignore
					node[ seen ] = true;
					path.replaceWith(
						t.ifStatement(
							logicalExpression,
							t.blockStatement( [
								t.expressionStatement( node ),
							] )
						)
					);
				}
			},
		},
	};
}

module.exports = babelPlugin;
