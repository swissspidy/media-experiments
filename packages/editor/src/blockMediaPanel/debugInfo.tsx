import { Blurhash } from 'react-blurhash';
import type { PropsWithChildren } from 'react';

import {
	BaseControl,
	ColorIndicator,
	PanelRow,
	useBaseControlProps,
	Tooltip,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalText as Text,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { Component, createInterpolateElement } from '@wordpress/element';

import { useAttachment } from '../utils/hooks';

interface DebugInfoProps {
	id: number;
}

const numberFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'unit',
	unit: 'byte',
	unitDisplay: 'narrow',
	// @ts-ignore -- TODO: Update types somehow.
	roundingPriority: 'lessPrecision',
	maximumSignificantDigits: 2,
	maximumFractionDigits: 2,
} );

interface HideOnErrorState {
	error: Error | null;
}

class HideOnError extends Component< PropsWithChildren< {} > > {
	state: HideOnErrorState;

	constructor( props: PropsWithChildren< {} > ) {
		super( props );

		this.state = {
			error: null,
		};
	}

	static getDerivedStateFromError( error: Error ) {
		return { error };
	}

	render() {
		const { error } = this.state;
		if ( ! error ) {
			return this.props.children;
		}

		return null;
	}
}

export function DebugInfo( { id }: DebugInfoProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const attachment = useAttachment( id );

	if ( ! attachment ) {
		return null;
	}

	const aspectRatio =
		( ( attachment.media_details.width as number ) ?? 1 ) /
		( ( attachment.media_details.height as number ) ?? 1 );

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Debug Information', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<div { ...controlProps }>
				<PanelRow>
					{ createInterpolateElement(
						sprintf(
							/* translators: %s: File type. */
							__( '<b>Mime type:</b> %s', 'media-experiments' ),
							attachment.mime_type
						),
						{
							b: <b />,
						}
					) }
				</PanelRow>
				{ attachment.mexp_filesize ? (
					<PanelRow>
						{ createInterpolateElement(
							sprintf(
								/* translators: %s: File size. */
								__(
									'<b>File size:</b> %s',
									'media-experiments'
								),
								numberFormatter.format(
									attachment.mexp_filesize
								)
							),
							{
								b: <b />,
							}
						) }
					</PanelRow>
				) : null }
				{ attachment.mexp_dominant_color ? (
					<PanelRow>
						{ createInterpolateElement(
							sprintf(
								/* translators: %s: Color indicator. */
								__(
									'<b>Dominant color:</b> %s',
									'media-experiments'
								),
								'<ColorIndicator />'
							),
							{
								b: <b />,
								ColorIndicator: (
									<Tooltip
										text={ attachment.mexp_dominant_color }
									>
										<Text
											aria-label={
												attachment.mexp_dominant_color
											}
										>
											<ColorIndicator
												colorValue={
													attachment.mexp_dominant_color
												}
											/>
										</Text>
									</Tooltip>
								),
							}
						) }
					</PanelRow>
				) : null }
				{ attachment.mexp_has_transparency !== null ? (
					<PanelRow>
						{ createInterpolateElement(
							attachment.mexp_has_transparency
								? __(
										'<b>Has transparency:</b> yes',
										'media-experiments'
								  )
								: __(
										'<b>Has transparency:</b> no',
										'media-experiments'
								  ),
							{
								b: <b />,
							}
						) }
					</PanelRow>
				) : null }
				{ attachment.mexp_blurhash ? (
					<HideOnError>
						<PanelRow>
							{ createInterpolateElement(
								sprintf(
									/* translators: %s: BlurHash. */
									__(
										'<b>BlurHash:</b> %s',
										'media-experiments'
									),
									'<Blurhash />'
								),
								{
									b: <b />,
									Blurhash: (
										<Blurhash
											hash={ attachment.mexp_blurhash }
											width={ 100 }
											height={ 100 / aspectRatio }
											data-blurhash={
												attachment.mexp_blurhash
											}
										/>
									),
								}
							) }
						</PanelRow>
					</HideOnError>
				) : null }
			</div>
		</BaseControl>
	);
}
