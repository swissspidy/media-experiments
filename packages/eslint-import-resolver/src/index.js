/**
 * External dependencies
 */
const nodeResolver = require( 'eslint-import-resolver-node' );
const path = require( 'path' );

const PACKAGES_DIR = path.resolve( __dirname, '../..' );

exports.interfaceVersion = 2;

/**
 * @typedef Config
 * @property {string[]} extensions File extensions.
 */

/**
 * Resolve a file.
 *
 * @param {string}  source
 * @param {string}  file
 * @param {?Config} config
 * @return {{path: null, found: boolean}|{path: *, found: boolean}|{found: boolean}} Resolver result.
 */
exports.resolve = function ( source, file, config = {} ) {
	const resolve = ( sourcePath ) =>
		nodeResolver.resolve( sourcePath, file, {
			...config,
			extensions: [ '.tsx', '.ts', '.mjs', '.js', '.json' ],
		} );

	if ( source.startsWith( '@mexp/' ) ) {
		const packageName = source.slice( '@mexp/'.length );

		const result = resolve( path.join( PACKAGES_DIR, packageName ) );

		if ( result.found ) {
			return result;
		}

		return resolve( path.join( PACKAGES_DIR, `${ packageName }/src/` ) );
	}

	return resolve( source );
};
