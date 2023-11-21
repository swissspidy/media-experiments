declare module '@wordpress/edit-post' {
	import {
		ReduxStoreConfig,
		StoreDescriptor,
	} from '@wordpress/data/build-types/types';
	import { MenuItem } from '@wordpress/components';
	import { ComponentType, ReactNode, ComponentProps } from 'react';

	const store: {
		name: 'core/edit-post';
	} & StoreDescriptor<
		ReduxStoreConfig<
			unknown,
			typeof import('./store/actions'),
			typeof import('./store/selectors')
		>
	>;

	interface PluginMoreMenuItemProps
		extends Omit< ComponentProps< typeof MenuItem >, 'href' > {
		children: ReactNode;
		/**
		 * When `href` is provided then the menu item is represented as an anchor rather than
		 * button. It corresponds to the `href` attribute of the anchor.
		 */
		href?: string | undefined;
		/**
		 * A Dashicon slug or a custom JSX element to be rendered to the left of the menu item
		 * label.
		 */
		icon?: JSX.Element | undefined;
		/**
		 * The callback function to be executed when the user clicks the menu item.
		 */
		onClick?(): void;
	}

	const PluginMoreMenuItem: ComponentType< PluginMoreMenuItemProps >;
}
