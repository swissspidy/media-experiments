declare module '@wordpress/edit-post' {
	import type {
		ReduxStoreConfig,
		StoreDescriptor,
	} from '@wordpress/data/build-types/types';

	const store: {
		name: 'core/edit-post';
	} & StoreDescriptor<
		ReduxStoreConfig<
			unknown,
			typeof import('./store/actions'),
			typeof import('./store/selectors')
		>
	>;
}
