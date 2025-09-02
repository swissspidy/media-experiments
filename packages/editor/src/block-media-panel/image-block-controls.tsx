/**
 * External dependencies
 */
import { createWorkerFactory } from '@shopify/web-worker';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { BlockControls } from '@wordpress/block-editor';
import { ToolbarDropdownMenu } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../constants';
import { ReactComponent as PhotoSpark } from '../icons/photo-spark.svg';
import { store as uploadStore } from '@mexp/upload-media';
import { image } from '@wordpress/icons';
import { createBlobURL } from '@wordpress/blob';

const createAiWorker = createWorkerFactory(
	() => import( /* webpackChunkName: 'ai' */ '@mexp/ai' )
);

const aiWorker = createAiWorker();

interface GenerateCaptionsProps {
	id?: number;
	url?: string;
	onUpdateCaption: ( caption: string ) => void;
	onUpdateAltText: ( alt: string ) => void;
}

export function ImageBlockControls( {
	id,
	url,
	onUpdateCaption,
	onUpdateAltText,
}: GenerateCaptionsProps ) {
	const [ captionInProgress, setCaptionInProgress ] = useState( false );
	const [ altInProgress, setAltInProgress ] = useState( false );

	const { createErrorNotice } = useDispatch( noticesStore );

	const isUploadingById = useSelect(
		( select ) =>
			id ? select( uploadStore ).isUploadingById( id ) : false,
		[ id ]
	);

	const useAi = useSelect( ( select ) => {
		return select( preferencesStore ).get(
			PREFERENCES_NAME,
			'useAi'
		) as boolean;
	}, [] );

	if ( ! url || ! useAi ) {
		return null;
	}

	const controls = [
		{
			title: __( 'Write caption', 'media-experiments' ),
			onClick: async () => {
				setCaptionInProgress( true );

				try {
					const result = await aiWorker.generateCaption(
						url,
						'<CAPTION>'
					);
					onUpdateCaption( result );
				} catch {
					void createErrorNotice(
						__(
							'There was an error generating the caption',
							'media-experiments'
						),
						{
							type: 'snackbar',
						}
					);
				} finally {
					setCaptionInProgress( false );
				}
			},
			role: 'menuitemradio',
			icon: undefined,
			isDisabled: captionInProgress,
		},
		{
			title: __( 'Write alternative text', 'media-experiments' ),
			onClick: async () => {
				setAltInProgress( true );

				try {
					const result = await aiWorker.generateCaption(
						url,
						'<DETAILED_CAPTION>'
					);
					onUpdateAltText( result );
				} catch {
					void createErrorNotice(
						__(
							'There was an error generating the alternative text',
							'media-experiments'
						),
						{
							type: 'snackbar',
						}
					);
				} finally {
					setAltInProgress( false );
				}
			},
			role: 'menuitemradio',
			icon: undefined,
			isDisabled: altInProgress,
		},
	];

	if ( id ) {
		controls.push( {
			title: __( 'Remove background', 'media-experiments' ),
			onClick: async () => {
				const editorCanvas =
					(
						( document.querySelector(
							'iframe[name="editor-canvas"]'
						) as HTMLIFrameElement ) || null
					)?.contentDocument || document;

				const imgElement = editorCanvas.querySelector(
					`img[src="${ url }"]`
				) as HTMLImageElement;

				const { FilesetResolver, ImageSegmenter } = await import(
					/* webpackChunkName: "chunk-tasks-vision" */ '@mediapipe/tasks-vision'
				);

				const wasmFileset = await FilesetResolver.forVisionTasks(
					'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
				);

				const imageSegmenter = await ImageSegmenter.createFromOptions(
					wasmFileset,
					{
						baseOptions: {
							modelAssetPath:
								'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
							delegate: 'GPU',
						},
						runningMode: 'IMAGE',
						outputCategoryMask: true,
					}
				);

				const imageCanvas = new OffscreenCanvas(
					imgElement.naturalWidth,
					imgElement.naturalHeight
				);
				const newCanvas = new OffscreenCanvas(
					imgElement.naturalWidth,
					imgElement.naturalHeight
				);

				const imageCanvasCtx = imageCanvas.getContext( '2d', {
					alpha: true,
				} );
				const newCanvasCtx = newCanvas.getContext( '2d', {
					alpha: true,
				} );

				if ( ! imageCanvasCtx || ! newCanvasCtx ) {
					return;
				}

				newCanvasCtx.clearRect(
					0,
					0,
					newCanvas.width,
					newCanvas.height
				);
				newCanvasCtx.drawImage( imgElement, 0, 0 );

				// Get pixel data from canvas containing original video frame
				const imageData = imageCanvasCtx.getImageData(
					0,
					0,
					imgElement.naturalWidth,
					imgElement.naturalHeight
				).data;

				// Get pixel data from canvas for background image
				const newCanvasImageData = newCanvasCtx.getImageData(
					0,
					0,
					imgElement.naturalWidth,
					imgElement.naturalHeight
				).data;

				const result = imageSegmenter.segment( imgElement );

				// Get mask from result - contains values 0-1 for foreground vs background
				const mask = result.categoryMask?.getAsFloat32Array() || [];
				let j = 0;

				// Loop through each pixel in mask
				for ( let i = 0; i < mask.length; ++i ) {
					// Convert float mask value to 0-255 integer
					const maskVal = Math.round( mask[ i ] * 255.0 );

					// Increment index by 4 for RGBA
					j += 4;

					// If mask pixel is background...
					if ( maskVal === 255 ) {
						// Copy pixel colors from imageData to backgroundData
						newCanvasImageData[ j ] = imageData[ j ];
						newCanvasImageData[ j + 1 ] = imageData[ j + 1 ];
						newCanvasImageData[ j + 2 ] = imageData[ j + 2 ];
						newCanvasImageData[ j + 3 ] = imageData[ j + 3 ];
					}
				}

				// Create new ImageData from modified background pixel data
				const uint8Array = new Uint8ClampedArray(
					newCanvasImageData.buffer
				);
				const dataNew = new ImageData(
					uint8Array,
					imgElement.naturalWidth,
					imgElement.naturalHeight
				);

				// Draw new background to canvas
				newCanvasCtx.putImageData( dataNew, 0, 0 );

				const blob = await newCanvas.convertToBlob( {
					type: 'image/webp',
				} );

				const blobURL = createBlobURL( blob );

				imgElement.src = blobURL;
			},
			role: 'menuitemradio',
			icon: undefined,
			isDisabled: isUploadingById,
		} );
	}

	return (
		<BlockControls group="inline">
			<ToolbarDropdownMenu
				label={ __( 'Help me write', 'media-experiments' ) }
				icon={ <PhotoSpark /> }
				controls={ controls }
			/>
		</BlockControls>
	);
}
