import type { ReactNode } from 'react';

import { useViewportMatch } from '@wordpress/compose';
/* eslint-disable @wordpress/no-unsafe-wp-apis */
import {
	Card,
	CardBody,
	CardHeader,
	FlexItem,
	__experimentalHStack as HStack,
	__experimentalItem as Item,
	__experimentalItemGroup as ItemGroup,
	__experimentalNavigatorBackButton as NavigatorBackButton,
	__experimentalNavigatorButton as NavigatorButton,
	__experimentalNavigatorProvider as NavigatorProvider,
	__experimentalNavigatorScreen as NavigatorScreen,
	__experimentalText as Text,
	__experimentalTruncate as Truncate,
} from '@wordpress/components';
/* eslint-enable @wordpress/no-unsafe-wp-apis */
import { useMemo, useState } from '@wordpress/element';
import { Icon, chevronLeft, chevronRight } from '@wordpress/icons';
import { __, isRTL } from '@wordpress/i18n';

import { Tabs } from '../tabs';

import './editor.css';

const PREFERENCES_MENU = 'preferences-menu';

interface TabSection {
	name: string;
	tabLabel: string;
	content: ReactNode;
}

interface PreferencesModalTabsProps {
	sections: TabSection[];
}

export function PreferencesModalTabs( {
	sections,
}: PreferencesModalTabsProps ) {
	const isLargeViewport = useViewportMatch( 'medium' );

	// This is also used to sync the two different rendered components
	// between small and large viewports.
	const [ activeMenu, setActiveMenu ] = useState< string | null | undefined >(
		PREFERENCES_MENU
	);
	/**
	 * Create helper objects from `sections` for easier data handling.
	 * `tabs` is used for creating the `Tabs` and `sectionsContentMap`
	 * is used for easier access to active tab's content.
	 */
	const { tabs, sectionsContentMap } = useMemo( () => {
		let mappedTabs: {
			tabs: { name: string; title: string }[];
			sectionsContentMap: Record< string, ReactNode >;
		} = {
			tabs: [],
			sectionsContentMap: {},
		};
		if ( sections.length ) {
			mappedTabs = sections.reduce(
				( accumulator, { name, tabLabel: title, content } ) => {
					accumulator.tabs.push( { name, title } );
					accumulator.sectionsContentMap[ name ] = content;
					return accumulator;
				},
				{ tabs: [], sectionsContentMap: {} } as {
					tabs: { name: string; title: string }[];
					sectionsContentMap: Record< string, ReactNode >;
				}
			);
		}
		return mappedTabs;
	}, [ sections ] );

	let modalContent: ReactNode;
	// We render different components based on the viewport size.
	if ( isLargeViewport ) {
		modalContent = (
			<div className="preferences__tabs">
				<Tabs
					initialTabId={
						activeMenu !== PREFERENCES_MENU
							? activeMenu || undefined
							: undefined
					}
					onSelect={ setActiveMenu }
					orientation="vertical"
				>
					<Tabs.TabList className="preferences__tabs-tablist">
						{ tabs.map( ( tab ) => (
							<Tabs.Tab
								tabId={ tab.name }
								key={ tab.name }
								className="preferences__tabs-tab"
							>
								{ tab.title }
							</Tabs.Tab>
						) ) }
					</Tabs.TabList>
					{ tabs.map( ( tab ) => (
						<Tabs.TabPanel
							tabId={ tab.name }
							key={ tab.name }
							className="preferences__tabs-tabpanel"
							focusable={ false }
						>
							{ sectionsContentMap[ tab.name ] || null }
						</Tabs.TabPanel>
					) ) }
				</Tabs>
			</div>
		);
	} else {
		modalContent = (
			<NavigatorProvider
				initialPath="/"
				className="preferences__provider"
			>
				<NavigatorScreen path="/">
					<Card isBorderless size="small">
						<CardBody>
							<ItemGroup>
								{ tabs.map( ( tab ) => {
									return (
										// @ts-ignore
										<NavigatorButton
											// @ts-ignore
											key={ tab.name }
											path={ tab.name }
											as={ Item }
											isAction
										>
											<HStack justify="space-between">
												<FlexItem>
													<Truncate>
														{ tab.title }
													</Truncate>
												</FlexItem>
												<FlexItem>
													<Icon
														icon={
															isRTL()
																? chevronLeft
																: chevronRight
														}
													/>
												</FlexItem>
											</HStack>
										</NavigatorButton>
									);
								} ) }
							</ItemGroup>
						</CardBody>
					</Card>
				</NavigatorScreen>
				{ sections.length &&
					sections.map( ( section ) => {
						return (
							<NavigatorScreen
								key={ `${ section.name }-menu` }
								path={ section.name }
							>
								<Card isBorderless size="large">
									{ /* @ts-ignore*/ }
									<CardHeader
										isBorderless={ false }
										justify="left"
										size="small"
										gap="6"
									>
										<NavigatorBackButton
											icon={
												isRTL()
													? chevronRight
													: chevronLeft
											}
											aria-label={ __(
												'Navigate to the previous view',
												'media-experiments'
											) }
										/>
										<Text size="16">
											{ section.tabLabel }
										</Text>
									</CardHeader>
									<CardBody>{ section.content }</CardBody>
								</Card>
							</NavigatorScreen>
						);
					} ) }
			</NavigatorProvider>
		);
	}

	return modalContent;
}
