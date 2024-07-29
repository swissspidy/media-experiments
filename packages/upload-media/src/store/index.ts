import { createReduxStore, register } from '@wordpress/data';

import reducer from './reducer';
import * as selectors from './selectors';
import * as privateSelectors from './private-selectors';
import * as actions from './actions';
import * as privateActions from './private-actions';
import { unlock } from '../lock-unlock';

export const STORE_NAME = 'media-experiments/upload';

export const store = createReduxStore( STORE_NAME, {
	reducer,
	selectors,
	actions,
} );

register( store );
unlock( store ).registerPrivateSelectors( privateSelectors );
unlock( store ).registerPrivateActions( privateActions );
