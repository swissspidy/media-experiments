/**
 * Internal dependencies
 */
import { BACKGROUND_BLUR_PX } from './constants';
import { type State, Type } from './types';

type AllSelectors = typeof import('./selectors');
type CurriedState< F > = F extends ( state: State, ...args: infer P ) => infer R
	? ( ...args: P ) => R
	: F;
type Selectors = {
	[ key in keyof AllSelectors ]: CurriedState< AllSelectors[ key ] >;
};

type ActionCreators = ( args: Record< string, unknown > ) => void;

export function getDevices() {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			dispatch( {
				type: Type.SetMediaDevices,
				devices: devices
					.filter( ( device ) => device.kind !== 'audiooutput' )
					// Label is empty if permissions somehow changed meantime,
					// remove these devices from the list.
					.filter( ( device ) => device.label ),
			} );
		} catch {
			// Do nothing for now.
		}
	};
}

// TODO: Does this really make sense as a resolver or should this just be an action?
export function getMediaStream() {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		if ( ! select.isInRecordingMode() ) {
			return;
		}

		dispatch( {
			type: Type.AcquireMedia,
		} );

		const mediaStreamConstraints: MediaStreamConstraints = {
			audio: false,
			video: false,
		};

		const hasAudio = select.hasAudio();
		const hasVideo = select.hasVideo();

		if ( hasAudio ) {
			const audioInput = select.getAudioInput();
			mediaStreamConstraints.audio = audioInput
				? { deviceId: audioInput }
				: true;
		}

		if ( hasVideo ) {
			const videoInput = select.getVideoInput();
			mediaStreamConstraints.video = videoInput
				? { deviceId: videoInput }
				: true;
		}

		// TODO: Retry without camera/audio if rejected with NotFoundError DOMException.
		try {
			const stream = await window.navigator.mediaDevices.getUserMedia(
				mediaStreamConstraints
			);

			if ( ! hasVideo ) {
				dispatch( {
					type: Type.SetMediaStream,
					stream,
					recordingStatus: 'ready',
				} );
				return;
			}

			const video = document.createElement( 'video' );

			await new Promise< HTMLVideoElement >( ( resolve, reject ) => {
				video.addEventListener( 'loadedmetadata', () =>
					resolve( video )
				);
				video.addEventListener( 'error', reject );

				video.muted = true;
				video.crossOrigin = 'anonymous';
				video.preload = 'metadata';
				video.autoplay = true;
				video.srcObject = stream;
			} );

			await video.play();

			const canvas = document.createElement( 'canvas' );
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;

			const canvasStream = canvas.captureStream();
			for ( const track of stream.getAudioTracks() ) {
				canvasStream.addTrack( track );
			}

			const ctx = canvas.getContext( '2d' );

			// TODO: Check whether that makes sense or if throwing error is better.
			if ( ! ctx ) {
				dispatch( {
					type: Type.SetMediaStream,
					stream,
					recordingStatus: 'ready',
				} );
				return;
			}

			const videoEffect = select.getVideoEffect();

			// TODO: Check for native support first.
			// See https://googlechrome.github.io/samples/image-capture/background-blur.html

			if ( videoEffect === 'blur' ) {
				const { ImageSegmenter, FilesetResolver } = await import(
					/* webpackChunkName: "chunk-image-segmenter" */ '@mediapipe/tasks-vision'
				);

				const vision = await FilesetResolver.forVisionTasks(
					`${ MEDIAPIPE_CDN_URL }/wasm`
				);

				// Use the selfie segmentation model from MediaPipe solutions
				const modelAssetPath =
					'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

				const imageSegmenter = await ImageSegmenter.createFromOptions(
					vision,
					{
						baseOptions: {
							modelAssetPath,
							delegate: 'GPU',
						},
						runningMode: 'VIDEO',
						outputCategoryMask: true,
						outputConfidenceMasks: false,
					}
				).catch(async (error) => {
					// Fallback to CPU if GPU fails
					console.warn('GPU delegate failed, falling back to CPU:', error);
					return ImageSegmenter.createFromOptions(
						vision,
						{
							baseOptions: {
								modelAssetPath,
								delegate: 'CPU',
							},
							runningMode: 'VIDEO',
							outputCategoryMask: true,
							outputConfidenceMasks: false,
						}
					);
				});

				let lastVideoTime = -1;

				const sendFrame = () => {
					if (
						select.getVideoEffect() !== 'blur' ||
						! [
							'acquiringMedia',
							'ready',
							'recording',
							'capturingImage',
							'paused',
							'countdown',
						].includes( select.getRecordingStatus() )
					) {
						imageSegmenter.close();
						for ( const track of stream.getTracks() ) {
							track.stop();
						}
						return;
					}

					const startTimeMs = performance.now();

					if ( video.currentTime !== lastVideoTime ) {
						lastVideoTime = video.currentTime;
						try {
							imageSegmenter.segmentForVideo(
								video,
								startTimeMs
							);
						} catch {
							// We can't do much about the WASM memory issue.
						}
					}

					const categoryMask = imageSegmenter.categoryMask;

					if ( categoryMask ) {
						const maskData = categoryMask.getAsUint8Array();

						// Draw the blurred background first
						ctx.save();
						ctx.filter = `blur(${ BACKGROUND_BLUR_PX }px)`;
						ctx.drawImage(
							video,
							0,
							0,
							canvas.width,
							canvas.height
						);
						ctx.restore();

						// Get the blurred background
						const blurredBackground = ctx.getImageData(
							0,
							0,
							canvas.width,
							canvas.height
						);

						// Get the original (sharp) video frame
						ctx.save();
						ctx.filter = 'none';
						ctx.drawImage(
							video,
							0,
							0,
							canvas.width,
							canvas.height
						);
						ctx.restore();

						const originalFrame = ctx.getImageData(
							0,
							0,
							canvas.width,
							canvas.height
						);

						// Composite the images based on the mask
						const outputData = new Uint8ClampedArray(
							canvas.width * canvas.height * 4
						);

						for (
							let i = 0;
							i < canvas.width * canvas.height;
							i++
						) {
							const maskValue = maskData[ i ];
							const pixelIndex = i * 4;

							// If mask value is 0, it's the person (foreground)
							// Otherwise it's the background
							if ( maskValue === 0 ) {
								// Use original (sharp) pixels for the person
								outputData[ pixelIndex ] =
									originalFrame.data[ pixelIndex ];
								outputData[ pixelIndex + 1 ] =
									originalFrame.data[ pixelIndex + 1 ];
								outputData[ pixelIndex + 2 ] =
									originalFrame.data[ pixelIndex + 2 ];
								outputData[ pixelIndex + 3 ] =
									originalFrame.data[ pixelIndex + 3 ];
							} else {
								// Use blurred pixels for the background
								outputData[ pixelIndex ] =
									blurredBackground.data[ pixelIndex ];
								outputData[ pixelIndex + 1 ] =
									blurredBackground.data[ pixelIndex + 1 ];
								outputData[ pixelIndex + 2 ] =
									blurredBackground.data[ pixelIndex + 2 ];
								outputData[ pixelIndex + 3 ] =
									blurredBackground.data[ pixelIndex + 3 ];
							}
						}

						const outputImageData = new ImageData(
							outputData,
							canvas.width,
							canvas.height
						);
						ctx.putImageData( outputImageData, 0, 0 );
					}

					requestAnimationFrame( sendFrame );
				};
				sendFrame();
			} else {
				const sendFrame = () => {
					if (
						select.getVideoEffect() !== 'none' ||
						! [
							'acquiringMedia',
							'ready',
							'recording',
							'capturingImage',
							'paused',
							'countdown',
						].includes( select.getRecordingStatus() )
					) {
						for ( const track of stream.getTracks() ) {
							track.stop();
						}
						return;
					}

					ctx.save();

					ctx.drawImage( video, 0, 0, canvas.width, canvas.height );

					ctx.restore();

					requestAnimationFrame( sendFrame );
				};
				sendFrame();
			}

			dispatch( {
				type: Type.SetMediaStream,
				stream: canvasStream,
				recordingStatus: 'ready',
			} );
		} catch ( error ) {
			dispatch( {
				type: Type.SetError,
				error,
			} );
		}
	};
}
