declare module '@wordpress/editor' {
	import {
		ReduxStoreConfig,
		StoreDescriptor,
	} from '@wordpress/data/build-types/types';

	const store: {
		name: 'core/editor';
	} & StoreDescriptor<
		ReduxStoreConfig<
			unknown,
			typeof import('./store/actions'),
			typeof import('./store/selectors')
		>
	>;
}
