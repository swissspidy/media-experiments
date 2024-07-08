import { createReduxStore, register } from '@wordpress/data';

import reducer from './reducer';
import * as selectors from './selectors';
import * as actions from './actions';
export const STORE_NAME = 'media-experiments/interface';

export const store = createReduxStore( STORE_NAME, {
	reducer,
	selectors,
	actions,
} );

register( store );
