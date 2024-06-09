import { v4 as uuidv4 } from 'uuid';

import { Fragment } from '@wordpress/element';
import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalText as Text,
	Button,
	PanelRow,
	Tooltip,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { __, sprintf } from '@wordpress/i18n';
import { filterURLForDisplay } from '@wordpress/url';
import { store as noticesStore } from '@wordpress/notices';

import { store as uploadStore } from '@mexp/upload-media';

import type { BulkOptimizationAttachmentData } from '../types';
import { ReactComponent as CompressIcon } from '../icons/compress.svg';
import { ApprovalDialog } from './approvalDialog';

const numberFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'unit',
	unit: 'byte',
	unitDisplay: 'narrow',
	roundingPriority: 'lessPrecision',
	maximumSignificantDigits: 2,
	maximumFractionDigits: 2,
} );

function Row( props: BulkOptimizationAttachmentData ) {
	const { optimizeExistingItem } = useDispatch( uploadStore );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	const onClick = () => {
		void optimizeExistingItem( {
			id: props.id,
			url: props.url,
			fileName: props.fileName,
			onSuccess: ( [ media ] ) => {
				void updateBlockAttributes( props.clientId, {
					id: media.id,
					url: media.url,
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
			},
		} );
	};

	// TODO: Add placeholder if there's no poster.
	return (
		<div role="listitem">
			<PanelRow>
				{ props.posterUrl ? (
					<img
						src={ props.posterUrl }
						width={ 32 }
						height={ 32 }
						alt=""
					/>
				) : null }
				<Tooltip text={ props.url }>
					<Text aria-label={ props.url }>
						{ filterURLForDisplay( props.url, 15 ) }
					</Text>
				</Tooltip>
				<Text variant="muted">
					{ props.fileSize
						? numberFormatter.format( props.fileSize )
						: /* translators: unknown file size */
						  __( '? KB', 'media-experiments' ) }
				</Text>
				<Button
					icon={ <CompressIcon width={ 32 } height={ 32 } /> }
					className="mexp-document-panel-row__button"
					label={ __( 'Optimize', 'media-experiments' ) }
					onClick={ onClick }
					disabled={ props.isUploading }
				></Button>
			</PanelRow>
		</div>
	);
}

function CompressAll( props: {
	attachments: BulkOptimizationAttachmentData[];
} ) {
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );
	const { optimizeExistingItem } = useDispatch( uploadStore );

	const onClick = () => {
		const batchId = uuidv4();

		for ( const attachment of props.attachments ) {
			if ( attachment.isUploading ) {
				continue;
			}

			void optimizeExistingItem( {
				batchId,
				id: attachment.id,
				url: attachment.url,
				fileName: attachment.fileName,
				onSuccess: ( [ media ] ) => {
					void updateBlockAttributes( attachment.clientId, {
						id: media.id,
						url: media.url,
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
				},
			} );
		}
	};

	const areAllUploading = props.attachments.every(
		( { isUploading } ) => isUploading
	);

	return (
		<Button
			variant="primary"
			onClick={ onClick }
			disabled={ areAllUploading }
		>
			{ __( 'Optimize all', 'media-experiments' ) }
		</Button>
	);
}

export function BulkOptimization( {
	attachments,
}: {
	attachments: BulkOptimizationAttachmentData[];
} ) {
	if ( ! attachments.length ) {
		return null;
	}

	return (
		<>
			<div role="list">
				{ attachments.map( ( data ) => (
					<Fragment key={ data.id }>
						<Row { ...data } />
						<ApprovalDialog id={ data.id } />
					</Fragment>
				) ) }
			</div>
			<PanelRow>
				<CompressAll attachments={ attachments } />
			</PanelRow>
		</>
	);
}
