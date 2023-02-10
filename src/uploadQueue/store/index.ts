import { register, createReduxStore } from '@wordpress/data';
import { STORE_NAME } from '../constants';

import reducer from './reducer';
import * as selectors from './selectors';
import * as actions from './actions';

export const store = createReduxStore(STORE_NAME, {
	reducer,
	selectors,
	actions,
});

register(store);
