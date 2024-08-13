/**
 * WordPress dependencies
 */
import { createReduxStore, register } from '@wordpress/data';

/**
 * Internal dependencies
 */
import reducer from './reducer';
import * as selectors from './selectors';
import * as actions from './actions';
import * as resolvers from './resolvers';

export const STORE_NAME = 'media-experiments/media-recording';

export const store = createReduxStore( STORE_NAME, {
	reducer,
	selectors,
	actions,
	resolvers,
} );

register( store );
