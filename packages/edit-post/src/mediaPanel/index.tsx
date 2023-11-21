import { Blurhash } from 'react-blurhash';
import {
	ReactCompareSlider,
	ReactCompareSliderImage,
} from 'react-compare-slider';

import {
	store as uploadStore,
	type Attachment,
	type RestAttachment,
} from '@mexp/upload-media';

import {
	Fragment,
	useState,
	useEffect,
	createInterpolateElement,
} from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { useDispatch, useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { createHigherOrderComponent } from '@wordpress/compose';
import type { Block, BlockEditProps } from '@wordpress/blocks';
import { InspectorControls } from '@wordpress/block-editor';
import {
	PanelBody,
	Notice,
	Button,
	BaseControl,
	useBaseControlProps,
	ColorIndicator,
	Modal,
} from '@wordpress/components';
import { isBlobURL } from '@wordpress/blob';
import { useEntityRecord } from '@wordpress/core-data';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';

import { store as recordingStore } from '../mediaRecording/store';
import './styles.css';

const SUPPORTED_BLOCKS = [ 'core/image', 'core/audio', 'core/video' ];

function useAttachment( id?: number ) {
	const { record } = useEntityRecord( 'postType', 'attachment', id || 0 );
	return record as RestAttachment | null;
}

function useIsUploadingById( id?: number ) {
	return useSelect(
		( select ) =>
			id ? select( uploadStore ).isUploadingById( id ) : false,
		[ id ]
	);
}

function useIsUploadingByUrl( url?: string ) {
	return useSelect(
		( select ) => {
			if ( ! url ) {
				return false;
			}

			const isUploading = select( uploadStore ).isUploadingByUrl( url );

			return isUploading || isBlobURL( url );
		},
		[ url ]
	);
}

interface UploadIndicatorProps {
	attachment: Partial< Attachment >;
}

function UploadIndicator( { attachment }: UploadIndicatorProps ) {
	const isUploadingById = useIsUploadingById( attachment.id );
	const isUploadingByUrl = useIsUploadingByUrl( attachment.url );
	const isPosterUploadingByUrl = useIsUploadingByUrl( attachment.poster );
	const isUploading = isUploadingById || isUploadingByUrl;

	const isPosterUploading = Boolean(
		isPosterUploadingByUrl ||
			( attachment.poster && isBlobURL( attachment.poster ) )
	);

	return (
		<Fragment>
			{ isUploading && (
				<Notice isDismissible={ false }>
					<p>{ __( 'Upload in progress', 'media-experiments' ) }</p>
				</Notice>
			) }
			{ isPosterUploading && (
				<Notice isDismissible={ false }>
					<p>
						{ __(
							'Poster Upload in progress',
							'media-experiments'
						) }
					</p>
				</Notice>
			) }
		</Fragment>
	);
}

interface MuteVideoProps {
	attributes: {
		id?: number;
		src: string;
		poster: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function MuteVideo( { attributes, setAttributes }: MuteVideoProps ) {
	const post = useAttachment( attributes.id );

	const url = attributes.src;
	const isUploading = useIsUploadingByUrl( url ) || isBlobURL( url );

	const { muteExistingVideo } = useDispatch( uploadStore );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	const onClick = () => {
		// TODO: Figure out why poster is not
		void muteExistingVideo( {
			id: attributes.id,
			url: attributes.src,
			poster: attributes.poster,
			onChange: ( [ media ] ) =>
				setAttributes( {
					src: media.url,
				} ),
			onSuccess: ( [ media ] ) =>
				setAttributes( {
					id: media.id,
					muted: true,
				} ),
			blurHash: post?.meta.mexp_blurhash,
			dominantColor: post?.meta.mexp_dominant_color,
			generatedPosterId: post?.meta.mexp_generated_poster_id,
			additionalData: {
				post: currentPostId,
			},
		} );
	};

	if ( ! post || post.meta.mexp_is_muted ) {
		return null;
	}

	return (
		<Button variant="primary" onClick={ onClick } disabled={ isUploading }>
			{ __( 'Remove audio channel', 'media-experiments' ) }
		</Button>
	);
}

interface RecordingControlsProps {
	name: string;
	clientId: string;
	attributes: {
		url?: string;
		src?: string;
	};
}

function RecordingControls( { attributes, clientId }: RecordingControlsProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	// Video and image blocks use different attribute names for the URL.
	const url = attributes.url || attributes.src;

	const { enterRecordingMode, leaveRecordingMode } =
		useDispatch( recordingStore );

	const isInRecordingMode = useSelect(
		( select ) => select( recordingStore ).isInRecordingMode(),
		[]
	);

	if ( url ) {
		return null;
	}

	const onClick = () => {
		if ( isInRecordingMode ) {
			void leaveRecordingMode();
		} else {
			void enterRecordingMode( clientId );
		}
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Self Recording', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					"Use your device's camera and microphone to record video, audio, or take a still picture",
					'media-experiments'
				) }
			</p>
			<Button variant="primary" onClick={ onClick } { ...controlProps }>
				{ isInRecordingMode
					? __( 'Stop', 'media-experiments' )
					: __( 'Start', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}

interface ImportMediaProps {
	attributes: {
		id?: number;
		url?: string;
		src?: string;
	};
	onChange: ( attachment: Partial< Attachment > ) => void;
}

function ImportMedia( { attributes, onChange }: ImportMediaProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	// Video and image blocks use different attribute names for the URL.
	const url = attributes.url || attributes.src;

	const { addItemFromUrl } = useDispatch( uploadStore );
	const isUploading = useIsUploadingByUrl( url );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);

	if ( attributes.id || ! url || isBlobURL( url ) ) {
		return null;
	}

	const onClick = () => {
		void addItemFromUrl( {
			url,
			onChange: ( [ media ] ) => onChange( media ),
			additionalData: {
				post: currentPostId,
			},
		} );
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Import external media', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'This file is not hosted on your site. Do you want to import it to your media library? Note: requires CORS.',
					'media-experiments'
				) }
			</p>
			<Button
				variant="primary"
				onClick={ onClick }
				disabled={ isUploading }
				{ ...controlProps }
			>
				{ __( 'Import', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}

const numberFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'unit',
	unit: 'byte',
	unitDisplay: 'narrow',
	roundingPriority: 'lessPrecision',
	maximumSignificantDigits: 2,
	maximumFractionDigits: 2,
} );

interface OptimizeMediaProps {
	attributes: {
		id?: number;
		poster?: string;
		src?: string;
		url?: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function OptimizeMedia( { attributes, setAttributes }: OptimizeMediaProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const [ _, setOpen ] = useState( false );
	const closeModal = () => setOpen( false );

	const post = useAttachment( attributes.id );
	const { optimizeExistingItem, rejectApproval, grantApproval } =
		useDispatch( uploadStore );
	const isUploading = useIsUploadingById( attributes.id );
	const currentPostId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);
	const { isPendingApproval, comparison } = useSelect(
		( select ) => ( {
			isPendingApproval: attributes.id
				? select( uploadStore ).isPendingApprovalByAttachmentId(
						attributes.id
				  )
				: false,
			comparison: attributes.id
				? select( uploadStore ).getComparisonDataForApproval(
						attributes.id
				  )
				: null,
		} ),
		[ attributes.id ]
	);
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );

	// Video and image blocks use different attribute names for the URL.
	const url = attributes.url || attributes.src;

	if ( ! attributes.id || ! url || isBlobURL( url ) ) {
		return null;
	}

	const onClick = () => {
		void optimizeExistingItem( {
			id: attributes.id,
			url: post?.source_url || url,
			poster: attributes.poster,
			onSuccess: ( [ media ] ) => {
				setAttributes( {
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
			blurHash: post?.meta.mexp_blurhash,
			dominantColor: post?.meta.mexp_dominant_color,
			generatedPosterId: post?.meta.mexp_generated_poster_id,
			additionalData: {
				post: currentPostId,
			},
		} );
	};

	const onApprove = () => {
		closeModal();
		void grantApproval( post.id );
	};

	const onReject = () => {
		closeModal();
		void rejectApproval( post.id );
	};

	// TODO: This needs some (async) checks first to see whether optimization is needed.

	return (
		<>
			<BaseControl { ...baseControlProps }>
				<BaseControl.VisualLabel>
					{ __( 'Optimize media', 'media-experiments' ) }
				</BaseControl.VisualLabel>
				<p>
					{ __(
						'Maybe you can make the file a bit smaller?',
						'media-experiments'
					) }
				</p>
				<Button
					variant="primary"
					onClick={ onClick }
					disabled={ isUploading }
					{ ...controlProps }
				>
					{ __( 'Optimize', 'media-experiments' ) }
				</Button>
			</BaseControl>
			{ isPendingApproval && comparison && (
				<Modal
					title={ __( 'Compare media quality', 'media-experiments' ) }
					onRequestClose={ onReject }
				>
					<div className="mexp-comparison-modal__labels">
						<p>
							{ sprintf(
								/* translators: %s: file size. */
								__( 'Old version: %s', 'media-experiments' ),
								numberFormatter.format( comparison.oldSize )
							) }
						</p>
						<p>
							{ sprintf(
								/* translators: %s: file size. */
								__( 'New version: %s', 'media-experiments' ),
								numberFormatter.format( comparison.newSize )
							) }
						</p>
					</div>
					<p>
						{ createInterpolateElement(
							comparison.sizeDiff > 0
								? sprintf(
										/* translators: %s: file size savings in percent. */
										__(
											'The new version is <b>%1$s%% smaller</b>!',
											'media-experiments'
										),
										comparison.sizeDiff
								  )
								: sprintf(
										/* translators: %s: file size increase in percent. */
										__(
											'The new version is <b>%1$s%% bigger</b> :(',
											'media-experiments'
										),
										comparison.sizeDiff
								  ),
							{
								b: <b />,
							}
						) }
					</p>
					<div className="mexp-comparison-modal__slider">
						<ReactCompareSlider
							itemOne={
								<ReactCompareSliderImage
									src={ comparison.oldUrl }
									alt={ __(
										'Original version',
										'media-experiments'
									) }
								/>
							}
							itemTwo={
								<ReactCompareSliderImage
									src={ comparison.newUrl }
									alt={ __(
										'Optimized version',
										'media-experiments'
									) }
								/>
							}
						/>
					</div>
					<div className="mexp-comparison-modal__buttons">
						<Button variant="primary" onClick={ onApprove }>
							{ __(
								'Use optimized version',
								'media-experiments'
							) }
						</Button>
						<Button variant="secondary" onClick={ onReject }>
							{ __( 'Cancel', 'media-experiments' ) }
						</Button>
					</div>
				</Modal>
			) }
		</>
	);
}

interface RestorePosterProps {
	attributes: {
		id?: number;
		poster?: string;
		src: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function RestorePoster( { attributes, setAttributes }: RestorePosterProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const [ posterId, setPosterId ] = useState< number | undefined >();

	const attachment = useAttachment( attributes.id );
	const poster = useAttachment( posterId );

	useEffect( () => {
		if ( ! attachment ) {
			return;
		}
		setPosterId(
			attachment.featured_media ||
				attachment.meta.mexp_generated_poster_id
		);
	}, [ attachment ] );

	const url = attributes.src;
	const isUploading = useIsUploadingByUrl( url ) || isBlobURL( url );

	if ( attributes.poster || isUploading || ! poster ) {
		return null;
	}

	const onClick = () => {
		setAttributes( {
			poster: poster.source_url,
		} );
	};

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Missing poster', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'Adding a poster image to videos is recommended, but your video is currently lacking one. However, you can restore the default auto-generated poster.',
					'media-experiments'
				) }
			</p>
			<Button variant="primary" onClick={ onClick } { ...controlProps }>
				{ __( 'Restore Poster', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}

interface ShowBlurHashProps {
	attributes: {
		id?: number;
	};
}

function ShowBlurHash( { attributes }: ShowBlurHashProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const attachment = useAttachment( attributes.id );

	if ( ! attachment || ! attachment.meta.mexp_blurhash ) {
		return null;
	}

	const aspectRatio =
		( ( attachment.media_details.width as number ) ?? 1 ) /
		( ( attachment.media_details.height as number ) ?? 1 );

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'BlurHash', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<div { ...controlProps }>
				<Blurhash
					hash={ attachment.meta.mexp_blurhash }
					width={ 200 }
					height={ 200 / aspectRatio }
				/>
			</div>
		</BaseControl>
	);
}

interface ShowDominantColorProps {
	attributes: {
		id?: number;
	};
}

function ShowDominantColor( { attributes }: ShowDominantColorProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const attachment = useAttachment( attributes.id );

	if ( ! attachment || ! attachment.meta.mexp_dominant_color ) {
		return null;
	}

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Dominant color', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<div { ...controlProps }>
				<ColorIndicator
					colorValue={ attachment.meta.mexp_dominant_color }
				/>
			</div>
		</BaseControl>
	);
}

interface VideoControlsProps {
	name: string;
	clientId: string;
	attributes: {
		id?: number;
		src: string;
		poster: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function VideoControls( props: VideoControlsProps ) {
	function onChange( media ) {
		if ( ! media || ! media.url ) {
			return;
		}

		props.setAttributes( {
			src: media.url,
			id: media.id,
			poster:
				media.image?.src !== media.icon ? media.image?.src : undefined,
			caption: media.caption,
		} );
	}

	return (
		<Fragment>
			<RecordingControls { ...props } />
			<ImportMedia { ...props } onChange={ onChange } />
			<MuteVideo { ...props } />
			<RestorePoster { ...props } />
			<ShowBlurHash { ...props } />
			<ShowDominantColor { ...props } />
		</Fragment>
	);
}

interface ImageControlsProps {
	name: string;
	clientId: string;
	attributes: {
		id?: number;
		url?: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function ImageControls( props: ImageControlsProps ) {
	function onChange( media ) {
		if ( ! media || ! media.url ) {
			return;
		}

		props.setAttributes( {
			url: media.url,
			id: media.id,
		} );
	}

	return (
		<Fragment>
			<RecordingControls { ...props } />
			<ImportMedia { ...props } onChange={ onChange } />
			<OptimizeMedia { ...props } />
			<ShowBlurHash { ...props } />
			<ShowDominantColor { ...props } />
		</Fragment>
	);
}

interface AudioControlsProps {
	name: string;
	clientId: string;
	attributes: {
		id?: number;
		src: string;
		poster: string;
	};
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function AudioControls( props: AudioControlsProps ) {
	function onChange( media ) {
		if ( ! media || ! media.url ) {
			return;
		}

		props.setAttributes( {
			url: media.url,
			id: media.id,
		} );
	}

	return (
		<Fragment>
			<RecordingControls { ...props } />
			<ImportMedia { ...props } onChange={ onChange } />
		</Fragment>
	);
}

interface BlockControlsProps {
	name: string;
	clientId: string;
	attributes: Record< string, unknown >;
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

function BlockControls( props: BlockControlsProps ) {
	switch ( props.name ) {
		case 'core/video':
			return (
				<>
					<VideoControls { ...props } />
				</>
			);
		case 'core/image':
			return (
				<>
					<ImageControls { ...props } />
				</>
			);

		case 'core/audio':
			return (
				<>
					<AudioControls { ...props } />
				</>
			);

		default:
			return null;
	}
}

type ImageBlock = Block< {
	id: number;
	url: string;
} >;

type AudioBlock = Block< {
	id: number;
	url: string;
} >;

type VideoBlock = Block< {
	id: number;
	source: string;
	poster: string;
	muted: boolean;
} >;

type MediaPanelProps = {
	name: Block[ 'name' ];
} & BlockEditProps<
	| ImageBlock[ 'attributes' ]
	| VideoBlock[ 'attributes' ]
	| AudioBlock[ 'attributes' ]
>;

function MediaPanel( {
	name,
	clientId,
	attributes,
	setAttributes,
}: MediaPanelProps ) {
	const attachment: Partial< Attachment > = {
		id: attributes.id,
		url: attributes.src || attributes.url,
		poster: attributes.poster,
	};

	return (
		<Fragment>
			<UploadIndicator attachment={ attachment } />
			<BlockControls
				name={ name }
				clientId={ clientId }
				attributes={ attributes }
				setAttributes={ setAttributes }
			/>
		</Fragment>
	);
}

const addMediaPanel = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		if ( ! SUPPORTED_BLOCKS.includes( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<Fragment>
				<BlockEdit { ...props } />
				<InspectorControls>
					<PanelBody
						initialOpen={ true }
						icon="admin-media"
						title={ __( 'Media Experiments', 'media-experiments' ) }
					>
						<MediaPanel { ...props } />
					</PanelBody>
				</InspectorControls>
			</Fragment>
		);
	},
	'withMediaPanel'
);

addFilter(
	'editor.BlockEdit',
	'media-experiments/add-media-panel',
	addMediaPanel
);
