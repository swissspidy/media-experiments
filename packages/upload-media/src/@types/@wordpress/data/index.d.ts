declare module '@wordpress/data' {
	import type {
		StoreDescriptor,
		AnyConfig,
		ActionCreatorsOf,
		CurriedSelectorsOf,
		ConfigOf,
		ReduxStoreConfig,
	} from '@wordpress/data/build-types/types';

	export type { StoreDescriptor };

	export function dispatch<T extends StoreDescriptor<AnyConfig>>(
		storeNameOrDescriptor: string | T
	): ActionCreatorsOf<ConfigOf<T>>;

	export function select<T extends StoreDescriptor<AnyConfig>>(
		storeNameOrDescriptor: string | T
	): CurriedSelectorsOf<T>;

	export function subscribe<T extends StoreDescriptor<AnyConfig>>(
		listener: () => void,
		storeNameOrDescriptor?: string | T
	): () => void;

	export function createReduxStore<
		State,
		Actions extends Record<string, any>,
		Selectors
	>(
		key: string,
		options: ReduxStoreConfig<State, Actions, Selectors>
	): StoreDescriptor<ReduxStoreConfig<State, Actions, Selectors>>;

	export function register<T extends StoreDescriptor<AnyConfig>>(
		storeDescriptor: T
	): void;
}
