/**
 * External dependencies
 */
import type { MouseEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalText as Text,
	Button,
	PanelRow,
	Tooltip,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalItemGroup as ItemGroup,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalItem as Item,
	Flex,
	Spinner,
	BaseControl,
	useBaseControlProps,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { __, sprintf } from '@wordpress/i18n';
import { filterURLForDisplay } from '@wordpress/url';
import { store as noticesStore } from '@wordpress/notices';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import type { BulkOptimizationAttachmentData } from '../../types';
import { ReactComponent as CompressIcon } from '../../icons/compress.svg';
import { ApprovalDialog } from '../approval-dialog';

import './editor.css';
import { useState } from '@wordpress/element';

const numberFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'unit',
	unit: 'byte',
	unitDisplay: 'narrow',
	roundingPriority: 'lessPrecision',
	maximumSignificantDigits: 2,
	maximumFractionDigits: 2,
} );

function Row(
	props: BulkOptimizationAttachmentData & { isBulkUploading: boolean }
) {
	const { optimizeExistingItem } = useDispatch( uploadStore );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	const { isUploading } = useSelect(
		( select ) => ( {
			isUploading: select( uploadStore ).isUploadingById( props.id ),
		} ),
		[ props.id ]
	);

	const onClick = ( evt: MouseEvent< HTMLButtonElement > ) => {
		void optimizeExistingItem( {
			id: props.id,
			url: props.url,
			fileName: props.mexp_filename || undefined,
			onSuccess: ( [ media ] ) => {
				void updateBlockAttributes( props.clientId, {
					id: media.id,
					url: media.url,
				} );

				void apiFetch( {
					path: `/wp/v2/media/${ props.id }`,
					data: {
						meta: {
							mexp_optimized_id: media.id,
						},
					},
					method: 'POST',
				} );

				void createSuccessNotice(
					__( 'File successfully optimized.', 'media-experiments' ),
					{
						type: 'snackbar',
					}
				);
			},
			onError: ( err: Error ) => {
				void createErrorNotice(
					sprintf(
						/* translators: %s: error message */
						__(
							'There was an error optimizing the file: %s',
							'media-experiments'
						),
						err.message
					),
					{
						type: 'snackbar',
					}
				);
			},
			additionalData: {
				post: currentPostId,
				mexp_media_source:
					window.mediaExperiments.mediaSourceTerms[
						'media-optimization'
					],
			},
			startTime: evt.timeStamp,
		} );
	};

	// TODO: Add placeholder if there's no poster.
	return (
		<>
			<Flex direction={ [ 'column', 'row' ] }>
				{ props.posterUrl ? (
					<img
						src={ props.posterUrl }
						width={ 32 }
						height={ 32 }
						alt=""
						className="mexp-bulk-optimization-row__image"
					/>
				) : null }
				<Tooltip text={ props.url }>
					<Text
						aria-label={ props.url }
						className="mexp-bulk-optimization-row__text"
					>
						{ filterURLForDisplay( props.url, 15 ) }
					</Text>
				</Tooltip>
				{ ! isUploading || props.isBulkUploading ? (
					<Text variant="muted">
						{ props.mexp_filesize
							? numberFormatter.format( props.mexp_filesize )
							: /* translators: unknown file size */
							  __( '? KB', 'media-experiments' ) }
					</Text>
				) : null }
				<div className="mexp-bulk-optimization-row__action">
					{ isUploading && ! props.isBulkUploading ? (
						<Spinner />
					) : (
						<Button
							icon={ <CompressIcon width={ 24 } height={ 24 } /> }
							size="compact"
							className="mexp-bulk-optimization-row__button"
							label={ __( 'Compress', 'media-experiments' ) }
							onClick={ onClick }
							disabled={ props.isBulkUploading }
						/>
					) }
				</div>
			</Flex>
		</>
	);
}

function CompressAll( props: {
	attachments: BulkOptimizationAttachmentData[];
	id: string;
	onStart: () => void;
	onSuccess: () => void;
	isBulkUploading: boolean;
} ) {
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	const { isUploadingById } = useSelect(
		( select ) => ( {
			isUploadingById: select( uploadStore ).isUploadingById,
		} ),
		[]
	);

	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );
	const { optimizeExistingItem } = useDispatch( uploadStore );

	const onClick = ( evt: MouseEvent< HTMLButtonElement > ) => {
		props.onStart();

		const batchId = uuidv4();

		for ( const attachment of props.attachments ) {
			if ( isUploadingById( attachment.id ) ) {
				continue;
			}

			void optimizeExistingItem( {
				batchId,
				id: attachment.id,
				url: attachment.url,
				fileName: attachment.mexp_filename || undefined,
				onSuccess: ( [ media ] ) => {
					// TODO: Update correct attribute depending on block type.
					// Video blocks use 'src'.
					void updateBlockAttributes( attachment.clientId, {
						id: media.id,
						url: media.url,
					} );

					void apiFetch( {
						path: `/wp/v2/media/${ attachment.id }`,
						data: {
							meta: {
								mexp_optimized_id: media.id,
							},
						},
						method: 'POST',
					} );
				},
				onError: ( err: Error ) => {
					void createErrorNotice(
						sprintf(
							/* translators: %s: error message */
							__(
								'There was an error optimizing the file: %s',
								'media-experiments'
							),
							err.message
						),
						{
							type: 'snackbar',
						}
					);
				},
				onBatchSuccess: () => {
					props.onSuccess();

					void createSuccessNotice(
						__(
							'All files successfully optimized.',
							'media-experiments'
						),
						{
							type: 'snackbar',
						}
					);
				},
				additionalData: {
					post: currentPostId,
					mexp_media_source:
						window.mediaExperiments.mediaSourceTerms[
							'media-optimization'
						],
				},
				startTime: evt.timeStamp,
			} );
		}
	};

	return (
		<Button
			variant="secondary"
			onClick={ onClick }
			disabled={ props.isBulkUploading }
			className="mexp-bulk-optimization-compress-all"
			id={ props.id }
		>
			{ props.isBulkUploading && <Spinner /> }
			{ __( 'Compress all', 'media-experiments' ) }
		</Button>
	);
}

export function BulkOptimization( {
	attachments,
}: {
	attachments: BulkOptimizationAttachmentData[];
} ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const [ isBulkUploading, setIsBulkUploading ] = useState( false );

	if ( ! attachments.length ) {
		return null;
	}

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Compress attachments', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<ItemGroup>
				{ attachments.map( ( data ) => (
					<Item
						key={ data.id }
						role="listitem"
						wrapperClassName="mexp-bulk-optimization-row"
					>
						<Row isBulkUploading={ isBulkUploading } { ...data } />
						<ApprovalDialog id={ data.id } />
					</Item>
				) ) }
			</ItemGroup>
			<PanelRow>
				<CompressAll
					attachments={ attachments }
					isBulkUploading={ isBulkUploading }
					onStart={ () => setIsBulkUploading( true ) }
					onSuccess={ () => setIsBulkUploading( false ) }
					{ ...controlProps }
				/>
			</PanelRow>
		</BaseControl>
	);
}
