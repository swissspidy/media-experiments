import { type Results } from '@mediapipe/selfie_segmentation';

import { blur } from '../utils';
import { BACKGROUND_BLUR_PX } from '../constants';
import { Type } from './types';

type AllSelectors = typeof import('./selectors');
type CurriedState< F > = F extends ( state: any, ...args: infer P ) => infer R
	? ( ...args: P ) => R
	: F;
type Selectors = {
	[ key in keyof AllSelectors ]: CurriedState< AllSelectors[ key ] >;
};

type ActionCreators = {
	( args: Record< string, unknown > ): void;
};

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
		} catch ( err ) {
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

		if ( select.hasAudio() ) {
			const audioInput = select.getAudioInput();
			mediaStreamConstraints.audio = audioInput
				? { deviceId: audioInput }
				: true;
		}

		if ( select.hasVideo() ) {
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
			stream
				.getAudioTracks()
				.forEach( ( track ) => canvasStream.addTrack( track ) );

			const context = canvas.getContext( '2d' );

			// TODO: Check whether that makes sense or if throwing error is better.
			if ( ! context ) {
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
				const { SelfieSegmentation } = await import(
					/* webpackChunkName: "chunk-selfie-segmentation" */ '@mediapipe/selfie_segmentation'
				);

				const selfieSegmentation = new SelfieSegmentation( {
					locateFile: ( file ) =>
						`https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${ file }`,
				} );

				selfieSegmentation.setOptions( {
					modelSelection: 1,
				} );

				await selfieSegmentation.initialize();

				const onSelfieSegmentationResults = ( results: Results ) => {
					if ( ! results.image || results.image.width === 0 ) {
						return;
					}

					// See https://github.com/riju/backgroundBlur/blob/main/explainer.md
					// See https://bugs.webkit.org/show_bug.cgi?id=198416
					const canvasBlur =
						'filter' in CanvasRenderingContext2D.prototype;

					context.save();

					// TODO: Remove fallback due to questionable license.
					// Fallback for Safari
					// See https://bugs.webkit.org/show_bug.cgi?id=198416
					if ( ! canvasBlur ) {
						context.drawImage(
							results.image,
							0,
							0,
							canvas.width,
							canvas.height
						);

						blur( context, BACKGROUND_BLUR_PX );

						context.globalCompositeOperation = 'destination-out';
						context.drawImage(
							results.segmentationMask,
							0,
							0,
							canvas.width,
							canvas.height
						);
						context.globalCompositeOperation = 'destination-over';
						context.drawImage(
							results.image,
							0,
							0,
							canvas.width,
							canvas.height
						);
					} else {
						context.globalCompositeOperation = 'copy';
						context.filter = `blur(${ BACKGROUND_BLUR_PX }px)`;
						context.drawImage(
							results.segmentationMask,
							0,
							0,
							canvas.width,
							canvas.height
						);

						context.globalCompositeOperation = 'source-in';
						context.filter = 'none';
						context.drawImage(
							results.image,
							0,
							0,
							canvas.width,
							canvas.height
						);

						context.globalCompositeOperation = 'destination-over';
						context.filter = `blur(${ BACKGROUND_BLUR_PX }px)`;
						context.drawImage(
							results.image,
							0,
							0,
							canvas.width,
							canvas.height
						);
					}

					context.restore();
				};

				selfieSegmentation.onResults( onSelfieSegmentationResults );
				const sendFrame = async () => {
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
						stream.getTracks().forEach( ( track ) => track.stop() );
						return;
					}

					try {
						await selfieSegmentation.send( { image: video } );
					} catch ( e ) {
						// We can't do much about the WASM memory issue.
					}

					requestAnimationFrame( sendFrame );
				};
				await sendFrame();
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
						stream.getTracks().forEach( ( track ) => track.stop() );
						return;
					}

					context.save();

					context.drawImage(
						video,
						0,
						0,
						canvas.width,
						canvas.height
					);

					context.restore();

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
