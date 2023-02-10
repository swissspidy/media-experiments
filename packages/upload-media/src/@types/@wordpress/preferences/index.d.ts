declare module '@wordpress/preferences' {
	import type {
		StoreDescriptor,
		ReduxStoreConfig,
	} from '@wordpress/data/build-types/types';

	export const store: StoreDescriptor<
		ReduxStoreConfig<
			any,
			{
				set: Function;
				setDefaults: Function;
				setPersistenceLayer: Function;
				toggle: Function;
			},
			{
				get: Function;
			}
		>
	>;
}
