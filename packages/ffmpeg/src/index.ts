/**
 * External dependencies
 */
import {
	Input,
	Output,
	Conversion,
	ALL_FORMATS,
	BlobSource,
	BufferTarget,
	Mp4OutputFormat,
	Mp3OutputFormat,
	WebMOutputFormat,
	OggOutputFormat,
	WavOutputFormat,
	FlacOutputFormat,
	QUALITY_MEDIUM,
	type ConversionOptions,
} from 'mediabunny';

/**
 * Helper function to perform media conversion using Mediabunny.
 *
 * @param file           Input file object.
 * @param outputMimeType Output mime type.
 * @param fileName       Output file name.
 * @param options        Additional conversion options.
 * @return Converted file object.
 */
async function convertWithMediabunny(
	file: File,
	outputMimeType: string,
	fileName: string,
	options: Partial< ConversionOptions > = {}
): Promise< File > {
	// Create input from the file
	const input = new Input( {
		source: new BlobSource( file ),
		formats: ALL_FORMATS,
	} );

	// Determine output format based on mime type
	let outputFormat;
	if ( outputMimeType.startsWith( 'video/mp4' ) ) {
		outputFormat = new Mp4OutputFormat();
	} else if ( outputMimeType.startsWith( 'video/webm' ) ) {
		outputFormat = new WebMOutputFormat();
	} else if (
		outputMimeType.startsWith( 'audio/mp3' ) ||
		outputMimeType.startsWith( 'audio/mpeg' )
	) {
		outputFormat = new Mp3OutputFormat();
	} else if ( outputMimeType.startsWith( 'audio/ogg' ) ) {
		outputFormat = new OggOutputFormat();
	} else if ( outputMimeType.startsWith( 'audio/wav' ) ) {
		outputFormat = new WavOutputFormat();
	} else if ( outputMimeType.startsWith( 'audio/flac' ) ) {
		outputFormat = new FlacOutputFormat();
	} else if ( outputMimeType.startsWith( 'audio/' ) ) {
		// For unsupported audio formats, throw an error
		throw new Error(
			`Unsupported audio format: ${ outputMimeType }. Supported formats: mp3, mpeg, ogg, wav, flac`
		);
	} else if ( outputMimeType.startsWith( 'video/' ) ) {
		// For unsupported video formats, throw an error
		throw new Error(
			`Unsupported video format: ${ outputMimeType }. Supported formats: mp4, webm`
		);
	} else {
		// For unknown formats, throw an error
		throw new Error( `Unsupported MIME type: ${ outputMimeType }` );
	}

	// Create output
	const output = new Output( {
		format: outputFormat,
		target: new BufferTarget(),
	} );

	// Initialize and execute conversion
	const conversion = await Conversion.init( {
		input,
		output,
		...options,
	} );

	await conversion.execute();

	// Create file from buffer
	const buffer = output.target.buffer;
	if ( ! buffer || buffer.byteLength === 0 ) {
		throw new Error( `File ${ fileName } could not be processed` );
	}

	return new File( [ buffer ], fileName, { type: outputMimeType } );
}

/**
 * Transcodes a video using Mediabunny.
 *
 * @param file      Original video file object.
 * @param basename  Video file name without extension.
 * @param mimeType  Mime type.
 * @param threshold Big video size threshold.
 * @return Processed video file object.
 */
export async function transcodeVideo(
	file: File,
	basename: string,
	mimeType: string,
	threshold: number
): Promise< File > {
	const ext = mimeType.split( '/' )[ 1 ];
	const outputFileName = `${ basename }.${ ext }`;

	const conversionOptions: Partial< ConversionOptions > = {
		video: {
			bitrate: QUALITY_MEDIUM,
			frameRate: 24, // Reduce to 24fps
		},
	};

	// Apply size threshold if specified
	if ( threshold > 0 ) {
		conversionOptions.video = {
			...conversionOptions.video,
			width: threshold,
			height: undefined, // height will be deduced automatically to retain aspect ratio
		};
	}

	return convertWithMediabunny(
		file,
		mimeType,
		outputFileName,
		conversionOptions
	);
}

/**
 * Mutes a video using Mediabunny while retaining the file type.
 *
 * @param file Original video file object.
 * @return Processed video file object.
 */
export async function muteVideo( file: File ): Promise< File > {
	// Create input from the file
	const input = new Input( {
		source: new BlobSource( file ),
		formats: ALL_FORMATS,
	} );

	// Get video track info to determine output format
	const videoTrack = await input.getPrimaryVideoTrack();
	let outputFormat;

	// Use appropriate output format based on input
	if ( file.type.startsWith( 'video/webm' ) ) {
		outputFormat = new WebMOutputFormat();
	} else if ( file.type === 'video/x-matroska' ) {
		outputFormat = new WebMOutputFormat();
	} else {
		outputFormat = new Mp4OutputFormat();
	}

	// Create output
	const output = new Output( {
		format: outputFormat,
		target: new BufferTarget(),
	} );

	// Initialize conversion with video only (no audio)
	const conversionOptions: Partial< ConversionOptions > = {
		input,
		output,
		video: videoTrack?.codec ? { codec: videoTrack.codec } : {},
		audio: {
			discard: true, // Discard all audio tracks
		},
	};

	const conversion = await Conversion.init( conversionOptions );

	await conversion.execute();

	// Create file from buffer
	const buffer = output.target.buffer;
	if ( ! buffer || buffer.byteLength === 0 ) {
		throw new Error( `File ${ file.name } could not be processed` );
	}

	return new File( [ buffer ], file.name, { type: file.type } );
}

/**
 * Transcodes an audio file using Mediabunny.
 *
 * @param file     Original audio file object.
 * @param basename Audio file name without extension.
 * @param mimeType Desired mime type.
 * @return Processed audio file object.
 */
export async function transcodeAudio(
	file: File,
	basename: string,
	mimeType: string
): Promise< File > {
	const ext = mimeType.split( '/' )[ 1 ];
	const outputFileName = `${ basename }.${ ext }`;

	return convertWithMediabunny( file, mimeType, outputFileName, {
		video: {
			discard: true, // Discard all video tracks
		},
		audio: {
			bitrate: QUALITY_MEDIUM,
		},
	} );
}

/**
 * Extracts a video's first frame as an image using canvas.
 *
 * Note: Exact seeking is not possible in most formats.
 *
 * @todo Remove? Currently unused.
 *
 * @param file      Original video file object.
 * @param basename  Video file name without extension.
 * @param threshold Big video size threshold.
 * @return File object for the video frame as a JPEG image.
 */
export async function getFirstFrameOfVideo(
	file: File,
	basename: string,
	threshold: number
): Promise< File > {
	const outputFileName = `${ basename }-poster.jpeg`;

	// Create a blob URL from the file
	const videoUrl = URL.createObjectURL( file );

	try {
		// Create a video element and load the file
		const video = document.createElement( 'video' );
		video.preload = 'metadata';
		video.muted = true;
		video.playsInline = true;

		// Wait for video to load
		await new Promise< void >( ( resolve, reject ) => {
			video.addEventListener( 'loadedmetadata', () => resolve(), {
				once: true,
			} );
			video.addEventListener( 'error', reject, { once: true } );
			video.src = videoUrl;
		} );

		// Seek to a very early frame (0.99 seconds like in utils.ts)
		video.currentTime = 0.99;
		await new Promise< void >( ( resolve, reject ) => {
			const timeout = setTimeout( () => {
				reject( new Error( 'Video seek timeout' ) );
			}, 3000 );

			video.addEventListener(
				'seeked',
				() => {
					clearTimeout( timeout );
					resolve();
				},
				{ once: true }
			);
			video.addEventListener(
				'error',
				( err ) => {
					clearTimeout( timeout );
					reject( err );
				},
				{ once: true }
			);
		} );

		// Create canvas and draw the video frame
		const canvas = document.createElement( 'canvas' );
		let width = video.videoWidth;
		let height = video.videoHeight;

		// Apply threshold if specified
		if ( threshold > 0 && ( width > threshold || height > threshold ) ) {
			const aspectRatio = width / height;
			if ( width > height ) {
				width = threshold;
				height = Math.round( threshold / aspectRatio );
			} else {
				height = threshold;
				width = Math.round( threshold * aspectRatio );
			}
		}

		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext( '2d' );
		if ( ! ctx ) {
			throw new Error( 'Could not get canvas context' );
		}

		ctx.drawImage( video, 0, 0, width, height );

		// Convert canvas to blob
		const blob = await new Promise< Blob | null >( ( resolve ) => {
			canvas.toBlob( resolve, 'image/jpeg', 0.82 );
		} );

		if ( ! blob ) {
			throw new Error( 'Could not create image blob' );
		}

		return new File( [ blob ], outputFileName, { type: 'image/jpeg' } );
	} finally {
		// Clean up the blob URL
		URL.revokeObjectURL( videoUrl );
	}
}

/**
 * Converts an animated GIF to a video using Mediabunny.
 *
 * @param file      Original GIF file object.
 * @param basename  GIF file name without extension.
 * @param mimeType  Desired mime type.
 * @param threshold Big video size threshold.
 * @return Converted video file object.
 */
export function convertGifToVideo(
	file: File,
	basename: string,
	mimeType: string,
	threshold: number
): Promise< File > {
	return transcodeVideo( file, basename, mimeType, threshold );
}
