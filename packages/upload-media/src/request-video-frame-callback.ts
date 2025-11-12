/**
 * Utility for using requestVideoFrameCallback with fallback support.
 *
 * requestVideoFrameCallback is a more efficient and accurate way to process
 * video frames compared to requestAnimationFrame, as it's synchronized with
 * the video's playback and provides precise metadata about each frame.
 *
 * Benefits over requestAnimationFrame:
 * - Synchronized with video frame updates (not just display refresh rate)
 * - Provides accurate frame metadata (presentation time, frame dimensions, etc.)
 * - Better performance for video processing tasks
 * - Avoids unnecessary callbacks when video is paused
 *
 * Browser Support:
 * - Chrome/Edge: 83+
 * - Safari: 15.4+
 * - Firefox: Not yet supported (as of early 2024)
 *
 * @see https://web.dev/articles/requestvideoframecallback-rvfc
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
 */

/// <reference path="./@types/dom.d.ts" />

/**
 * Checks if requestVideoFrameCallback is supported by the browser.
 *
 * @return Whether requestVideoFrameCallback is supported.
 */
export function supportsRequestVideoFrameCallback(): boolean {
	if ( typeof HTMLVideoElement === 'undefined' ) {
		return false;
	}
	return (
		'requestVideoFrameCallback' in HTMLVideoElement.prototype &&
		typeof HTMLVideoElement.prototype.requestVideoFrameCallback ===
			'function'
	);
}

/**
 * Wrapper for requestVideoFrameCallback that falls back to requestAnimationFrame
 * if the native API is not available.
 *
 * @param video    The video element.
 * @param callback The callback to invoke for each frame.
 * @return A cancel function to stop the frame callbacks.
 */
export function requestVideoFrame(
	video: HTMLVideoElement,
	callback: (
		now: DOMHighResTimeStamp,
		metadata?: VideoFrameMetadata
	) => void
): () => void {
	const hasNativeSupport = supportsRequestVideoFrameCallback();

	if ( hasNativeSupport && video.requestVideoFrameCallback ) {
		let handle: number | null = null;

		const scheduleCallback = () => {
			handle = video.requestVideoFrameCallback!(
				( now, metadata ) => {
					callback( now, metadata );
				}
			);
		};

		scheduleCallback();

		return () => {
			if ( handle !== null && video.cancelVideoFrameCallback ) {
				video.cancelVideoFrameCallback( handle );
				handle = null;
			}
		};
	}

	// Fallback to requestAnimationFrame
	let rafHandle: number | null = null;

	const rafCallback = ( now: DOMHighResTimeStamp ) => {
		// Create a basic metadata object for compatibility
		const metadata: VideoFrameMetadata = {
			presentationTime: video.currentTime * 1000, // Convert to ms
			expectedDisplayTime: now,
			width: video.videoWidth,
			height: video.videoHeight,
			mediaTime: video.currentTime,
			presentedFrames: 0,
		};

		callback( now, metadata );
	};

	const scheduleRafCallback = () => {
		rafHandle = requestAnimationFrame( rafCallback );
	};

	scheduleRafCallback();

	return () => {
		if ( rafHandle !== null ) {
			cancelAnimationFrame( rafHandle );
			rafHandle = null;
		}
	};
}

/**
 * Continuously processes video frames using requestVideoFrameCallback or
 * requestAnimationFrame fallback.
 *
 * The callback is invoked repeatedly for each video frame. The loop continues
 * until the provided shouldContinue function returns false, or until the
 * returned cancel function is called.
 *
 * @param video          The video element.
 * @param callback       The callback to invoke for each frame.
 * @param shouldContinue Optional function to determine if the loop should continue.
 *                        If not provided, the loop runs indefinitely until cancelled.
 * @return A cancel function to stop the frame processing loop.
 */
export function requestVideoFrameLoop(
	video: HTMLVideoElement,
	callback: (
		now: DOMHighResTimeStamp,
		metadata?: VideoFrameMetadata
	) => void,
	shouldContinue?: () => boolean
): () => void {
	const hasNativeSupport = supportsRequestVideoFrameCallback();
	let cancelled = false;

	const checkAndContinue = (
		now: DOMHighResTimeStamp,
		metadata?: VideoFrameMetadata
	) => {
		if ( cancelled ) {
			return;
		}

		if ( shouldContinue && ! shouldContinue() ) {
			return;
		}

		callback( now, metadata );
		scheduleNext();
	};

	let currentCancel: ( () => void ) | null = null;

	const scheduleNext = () => {
		if ( cancelled ) {
			return;
		}

		if ( hasNativeSupport && video.requestVideoFrameCallback ) {
			const handle = video.requestVideoFrameCallback!(
				( now, metadata ) => {
					checkAndContinue( now, metadata );
				}
			);

			currentCancel = () => {
				if ( video.cancelVideoFrameCallback ) {
					video.cancelVideoFrameCallback( handle );
				}
			};
		} else {
			// Fallback to requestAnimationFrame
			const handle = requestAnimationFrame( ( now ) => {
				const metadata: VideoFrameMetadata = {
					presentationTime: video.currentTime * 1000,
					expectedDisplayTime: now,
					width: video.videoWidth,
					height: video.videoHeight,
					mediaTime: video.currentTime,
					presentedFrames: 0,
				};
				checkAndContinue( now, metadata );
			} );

			currentCancel = () => {
				cancelAnimationFrame( handle );
			};
		}
	};

	scheduleNext();

	return () => {
		cancelled = true;
		if ( currentCancel ) {
			currentCancel();
			currentCancel = null;
		}
	};
}
