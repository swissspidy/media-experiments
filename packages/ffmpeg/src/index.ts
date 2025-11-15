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
	} else {
		// Default to MP4
		outputFormat = new Mp4OutputFormat();
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
	if (file.type.startsWith('video/webm')) {
		outputFormat = new WebMOutputFormat();
	} else if (file.type === 'video/x-matroska') {
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
		video: {
			// Copy video settings from input
			codec: videoTrack?.codec ?? undefined,
		},
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
 * Extracts a video's first frame using Mediabunny.
 *
 * Note: Exact seeking is not possible in most formats.
 *
 * @todo Remove? Currently unused.
 *
 * @param file      Original video file object.
 * @param basename  Video file name without extension.
 * @param threshold Big video size threshold.
 * @return File object for the video frame.
 */
export async function getFirstFrameOfVideo(
	file: File,
	basename: string,
	threshold: number
): Promise< File > {
	const outputFileName = `${ basename }-poster.jpeg`;

	// Create input from the file
	const input = new Input( {
		source: new BlobSource( file ),
		formats: ALL_FORMATS,
	} );

	// Create output
	const output = new Output( {
		format: new Mp4OutputFormat(),
		target: new BufferTarget(),
	} );

	const conversionOptions: Partial< ConversionOptions > = {
		input,
		output,
		video: {
			bitrate: QUALITY_MEDIUM,
		},
		audio: {
			discard: true,
		},
		// TODO: Add frame extraction options when available in Mediabunny
		// For now, we'll convert the first second and extract first frame
	};

	if ( threshold > 0 ) {
		conversionOptions.video = {
			...conversionOptions.video,
			width: threshold,
		};
	}

	const conversion = await Conversion.init( conversionOptions );

	await conversion.execute();

	const buffer = output.target.buffer;
	if ( ! buffer || buffer.byteLength === 0 ) {
		throw new Error( `File ${ outputFileName } could not be processed` );
	}

	// For now, return the processed video
	// TODO: Implement proper frame extraction when Mediabunny supports it
	return new File( [ buffer ], outputFileName, { type: 'image/jpeg' } );
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
