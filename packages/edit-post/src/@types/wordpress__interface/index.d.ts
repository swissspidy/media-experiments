declare module '@wordpress/interface' {
	import {
		ReduxStoreConfig,
		StoreDescriptor,
	} from '@wordpress/data/build-types/types';
	import { ToggleControl } from '@wordpress/components';
	import { ComponentType, ReactNode, ComponentProps } from 'react';

	const store: {
		name: 'core/interface';
	} & StoreDescriptor<
		ReduxStoreConfig<
			unknown,
			typeof import('./store/actions'),
			typeof import('./store/selectors')
		>
	>;

	interface PreferencesModalProps {
		children: ReactNode;
		closeModal?(): void;
	}

	const PreferencesModal: ComponentType< PreferencesModalProps >;

	interface TabSection {
		name: string;
		tabLabel: string;
		content: ReactNode;
	}

	interface PreferencesModalTabsProps {
		sections: TabSection[];
	}

	const PreferencesModalTabs: ComponentType< PreferencesModalTabsProps >;
	interface PreferencesModalSectionProps {
		children: ReactNode;
		description: string;
		title: string;
	}

	const PreferencesModalSection: ComponentType< PreferencesModalSectionProps >;
	interface BaseOptionProps
		extends Pick<
			ComponentProps< typeof ToggleControl >,
			'help' | 'label' | 'onChange'
		> {
		isChecked: boolean;
	}

	const ___unstablePreferencesModalBaseOption: ComponentType< BaseOptionProps >;
}
