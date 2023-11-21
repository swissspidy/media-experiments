declare module '@wordpress/preferences' {
	import type {
		StoreDescriptor,
		ReduxStoreConfig,
	} from '@wordpress/data/build-types/types';

	export * from '@wordpress/preferences';

	export const store: StoreDescriptor<
		ReduxStoreConfig<
			unknown,
			{
				set: (
					scope: string,
					name: string,
					value: unknown
				) => Record< string, unknown >;
				setDefaults: (
					scope: string,
					defaults: Record< string, unknown >
				) => void;
				setPersistenceLayer: (
					persistenceLayer: unknown
				) => Record< string, unknown >;
				toggle: (
					scope: string,
					name: string
				) => Record< string, unknown >;
			},
			{
				get: ( scope: string, name: string ) => boolean;
			}
		>
	>;
}
