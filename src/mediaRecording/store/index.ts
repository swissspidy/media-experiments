import { register, createReduxStore, dispatch } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

import reducer from './reducer';
import * as selectors from './selectors';
import * as actions from './actions';
import * as resolvers from './resolvers';

export const STORE_NAME = 'media-experiments/media-recording';

export const store = createReduxStore(STORE_NAME, {
	reducer,
	selectors,
	actions,
	resolvers,
});

register(store);

// The idea was to store these preferences in a persistent way.
// TODO: Figure out how to best achieve this and keep things in sync (e.g. when updating media devices list)
dispatch(preferencesStore).setDefaults(STORE_NAME, {
	videoInput: undefined,
	audioInput: undefined,
	videoEffect: 'none',
});
