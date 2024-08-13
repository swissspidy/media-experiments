/**
 * WordPress dependencies
 */
import { createReduxStore, register } from '@wordpress/data';

/**
 * Internal dependencies
 */
import reducer from './reducer';
import * as selectors from './selectors';
import * as privateSelectors from './private-selectors';
import * as actions from './actions';
import * as privateActions from './private-actions';

export const STORE_NAME = 'media-experiments/upload';

/*
 Private selectors and actions would be normally be registered via @wordpress/private-apis,
 but that package cannot be used by non-WordPress packages.
 However, separating the functions into two groups helps with code organization,
 making a later migration to Gutenberg easier.
 See https://github.com/swissspidy/media-experiments/pull/591.
 */

export const store = createReduxStore( STORE_NAME, {
	reducer,
	selectors: {
		...selectors,
		...privateSelectors,
	} as typeof selectors & typeof privateSelectors,
	actions: {
		...actions,
		...privateActions,
	} as typeof actions & typeof privateActions,
} );

register( store );
