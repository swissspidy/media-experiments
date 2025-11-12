/**
 * Example usage of requestVideoFrameCallback utilities
 * 
 * This file demonstrates how to use the new requestVideoFrameCallback
 * functionality in the Media Experiments plugin.
 */

/**
 * Example 1: Feature Detection
 * 
 * Check if the browser supports requestVideoFrameCallback
 */
import { supportsRequestVideoFrameCallback } from '@mexp/upload-media';

const hasSupport = supportsRequestVideoFrameCallback();
if ( hasSupport ) {
	console.log( 'Browser supports requestVideoFrameCallback!' );
} else {
	console.log( 'Using requestAnimationFrame fallback' );
}

/**
 * Example 2: Single Frame Capture
 * 
 * Capture a single video frame with metadata
 */
import { requestVideoFrame } from '@mexp/upload-media';

const video = document.querySelector( 'video' );

const cancel = requestVideoFrame( video, ( now, metadata ) => {
	console.log( 'Frame captured at:', now );
	
	if ( metadata ) {
		console.log( 'Frame metadata:', {
			presentationTime: metadata.presentationTime,
			width: metadata.width,
			height: metadata.height,
			mediaTime: metadata.mediaTime,
			presentedFrames: metadata.presentedFrames,
		} );
	}
} );

// Cancel if needed
// cancel();

/**
 * Example 3: Continuous Frame Processing
 * 
 * Process video frames continuously with automatic loop
 */
import { requestVideoFrameLoop } from '@mexp/upload-media';

const video = document.querySelector( 'video' );
let frameCount = 0;

const cancel = requestVideoFrameLoop(
	video,
	( now, metadata ) => {
		frameCount++;
		console.log( `Processing frame #${ frameCount }` );
		
		// Process the frame here
		// For example, apply effects, extract features, etc.
	},
	() => {
		// Optional: condition to continue processing
		// Return false to stop the loop
		return frameCount < 100;
	}
);

// Stop processing when done
// cancel();

/**
 * Example 4: Video Frame Analysis
 * 
 * Analyze video frames for quality metrics
 */
import { requestVideoFrameLoop } from '@mexp/upload-media';

const video = document.querySelector( 'video' );
const metrics = {
	totalFrames: 0,
	droppedFrames: 0,
	averageProcessingTime: 0,
};

let previousPresentedFrames = 0;

const cancel = requestVideoFrameLoop(
	video,
	( now, metadata ) => {
		if ( ! metadata ) {
			return;
		}

		metrics.totalFrames++;

		// Detect dropped frames
		const expectedFrames = metadata.presentedFrames - previousPresentedFrames;
		if ( expectedFrames > 1 ) {
			metrics.droppedFrames += expectedFrames - 1;
		}
		previousPresentedFrames = metadata.presentedFrames;

		// Track processing duration if available
		if ( metadata.processingDuration ) {
			metrics.averageProcessingTime =
				( metrics.averageProcessingTime * ( metrics.totalFrames - 1 ) +
					metadata.processingDuration ) /
				metrics.totalFrames;
		}

		// Log metrics every 100 frames
		if ( metrics.totalFrames % 100 === 0 ) {
			console.log( 'Video metrics:', metrics );
		}
	}
);

// Stop analysis
// cancel();

/**
 * Example 5: Real-time Video Effects
 * 
 * Apply real-time effects to video frames
 */
import { requestVideoFrameLoop } from '@mexp/upload-media';

const video = document.querySelector( 'video' );
const canvas = document.createElement( 'canvas' );
const ctx = canvas.getContext( '2d' );

canvas.width = video.videoWidth;
canvas.height = video.videoHeight;

const cancel = requestVideoFrameLoop(
	video,
	( now, metadata ) => {
		if ( ! metadata || ! ctx ) {
			return;
		}

		// Draw the current frame to canvas
		ctx.drawImage( video, 0, 0, canvas.width, canvas.height );

		// Apply effects (e.g., grayscale)
		const imageData = ctx.getImageData( 0, 0, canvas.width, canvas.height );
		const data = imageData.data;

		for ( let i = 0; i < data.length; i += 4 ) {
			const avg = ( data[ i ] + data[ i + 1 ] + data[ i + 2 ] ) / 3;
			data[ i ] = avg; // Red
			data[ i + 1 ] = avg; // Green
			data[ i + 2 ] = avg; // Blue
			// data[i+3] is alpha, leave it unchanged
		}

		ctx.putImageData( imageData, 0, 0 );
	},
	() => ! video.paused && ! video.ended
);

// Display the processed canvas
document.body.appendChild( canvas );

// Stop processing
// cancel();

/**
 * Example 6: Optimal Poster Frame Selection
 * 
 * Select the best frame for a video poster by analyzing multiple frames
 */
import { requestVideoFrameLoop } from '@mexp/upload-media';

const video = document.querySelector( 'video' );
const canvas = document.createElement( 'canvas' );
const ctx = canvas.getContext( '2d' );

canvas.width = video.videoWidth;
canvas.height = video.videoHeight;

let bestFrame = null;
let maxBrightness = 0;

const cancel = requestVideoFrameLoop(
	video,
	( now, metadata ) => {
		if ( ! metadata || ! ctx ) {
			return;
		}

		// Draw current frame
		ctx.drawImage( video, 0, 0, canvas.width, canvas.height );

		// Calculate average brightness
		const imageData = ctx.getImageData( 0, 0, canvas.width, canvas.height );
		const data = imageData.data;
		let totalBrightness = 0;

		for ( let i = 0; i < data.length; i += 4 ) {
			const brightness = ( data[ i ] + data[ i + 1 ] + data[ i + 2 ] ) / 3;
			totalBrightness += brightness;
		}

		const avgBrightness = totalBrightness / ( canvas.width * canvas.height );

		// Save the brightest frame
		if ( avgBrightness > maxBrightness ) {
			maxBrightness = avgBrightness;
			bestFrame = ctx.getImageData( 0, 0, canvas.width, canvas.height );
		}
	},
	() => video.currentTime < 5 // Analyze first 5 seconds
);

// After analysis completes, use bestFrame as poster
video.addEventListener( 'pause', () => {
	if ( bestFrame && ctx ) {
		ctx.putImageData( bestFrame, 0, 0 );
		console.log( 'Best poster frame selected with brightness:', maxBrightness );
	}
} );
