declare module '@wordpress/block-editor' {
	import {
		ReduxStoreConfig,
		StoreDescriptor,
	} from '@wordpress/data/build-types/types';

	import {
		ComponentType,
		FC,
		MouseEventHandler,
		ReactFragment,
		ReactNode,
		ComponentProps,
	} from 'react';
	import { Slot, Toolbar } from '@wordpress/components';

	const store: {
		name: 'core/block-editor';
	} & StoreDescriptor<
		ReduxStoreConfig<
			unknown,
			typeof import('./store/actions'),
			typeof import('./store/selectors')
		>
	>;

	import { Ref, RefCallback } from 'react';

	interface Reserved {
		id: string;
		role: 'document';
		tabIndex: 0;
		'aria-label': string;
		'data-block': string;
		'data-type': string;
		'data-title': string;
	}

	interface Merged {
		className: string;
		style: Record< string, unknown >;
		ref: RefCallback< unknown >;
	}

	interface UseBlockProps {
		< Props extends Record< string, unknown > >(
			props?: Props & {
				[ K in keyof Props ]: K extends keyof Reserved
					? never
					: Props[ K ];
			} & { ref?: Ref< unknown > }
		): Omit< Props, 'ref' > & Merged & Reserved;

		save: (
			props?: Record< string, unknown >
		) => Record< string, unknown >;
	}

	const useBlockProps: UseBlockProps;

	interface WarningProps {
		actions?: ReactFragment | undefined;
		children: ReactNode;
		className?: string | undefined;
		secondaryActions?:
			| Array< {
					title: ReactNode;
					onClick: MouseEventHandler< HTMLButtonElement >;
			  } >
			| undefined;
	}

	const Warning: ComponentType< WarningProps >;

	interface BlockControlsProps extends ComponentProps< typeof Toolbar > {
		children: ReactNode;
		group: string;
	}

	const BlockControls: {
		( props: Partial< BlockControlsProps > ): JSX.Element;
		Slot: FC< Omit< ComponentProps< typeof Slot >, 'name' > >;
	};

	interface InspectorControlsProps {
		children: ReactNode;
	}

	const InspectorControls: {
		( props: InspectorControlsProps ): JSX.Element;
	};
}
