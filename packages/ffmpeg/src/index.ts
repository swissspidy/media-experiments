import { v4 as uuidv4 } from 'uuid';
import { getExtensionFromMimeType } from '@mexp/mime';
import type { FFmpeg } from '@ffmpeg/ffmpeg';

const VIDEO_CODEC: Record< string, string > = {
	'video/mp4': 'libx264', // H.264
	'video/webm': 'libvpx-vp9',
};

const AUDIO_CODEC: Record< string, string > = {
	'audio/mp3': 'libmp3lame',
	'audio/ogg': 'libvorbis',
};

const FFMPEG_CONFIG = {
	FPS: [
		// Reduce to 24fps.
		// See https://trac.ffmpeg.org/wiki/ChangingFrameRate
		'-r',
		'24',
	],
	FASTSTART: [
		// move some information to the beginning of your file.
		'-movflags',
		'+faststart',
	],
	COLOR_PROFILE: [
		// Simpler color profile
		'-pix_fmt',
		'yuv420p',
	],
	PRESET: [
		// As the name says...
		'-preset',
		'fast', // 'veryfast' seems to cause crashes.
	],
	SEEK_TO_START: [
		// Desired position.
		// Using as an input option (before -i) saves us some time by seeking to position.
		'-ss',
		'00:00:01.000',
	],
	SINGLE_FRAME: [
		// Stop writing to the stream after 1 frame.
		'-frames:v',
		'1',
	],
};

const ffmpegCoreUrl = FFMPEG_CDN_URL;

const isDevelopment = typeof SCRIPT_DEBUG !== 'undefined' && SCRIPT_DEBUG;

function readFile( file: File ): Promise< Uint8Array > {
	const reader = new FileReader();
	return new Promise( ( resolve, reject ) => {
		reader.addEventListener( 'load', () =>
			resolve( new Uint8Array( reader.result as ArrayBuffer ) )
		);
		reader.addEventListener( 'error', ( event ) =>
			event.target?.error?.code
				? reject(
						new Error(
							`Could not read file (Code: ${ event.target.error.code })`
						)
				  )
				: reject( new Error( 'Could not read file' ) )
		);
		reader.readAsArrayBuffer( file );
	} );
}

async function loadFFmpeg( file: File ) {
	const { createFFmpeg } = await import(
		/* webpackChunkName: "chunk-ffmpeg" */
		'@ffmpeg/ffmpeg'
	);

	const ffmpeg = createFFmpeg( {
		corePath: ffmpegCoreUrl,
		log: isDevelopment,
	} );
	await ffmpeg.load();

	ffmpeg.FS( 'writeFile', file.name, await readFile( file ) );

	return ffmpeg;
}

/**
 * Runs FFmpeg with a given config.
 *
 * @param file     Input file object.
 * @param config   FFmpeg config arguments.
 * @param mimeType Output mime type.
 * @param fileName Output file name.
 * @return Output file object.
 */
async function runFFmpegWithConfig(
	file: File,
	config: string[],
	mimeType: string,
	fileName: string
): Promise< File > {
	let ffmpeg: FFmpeg | undefined;

	try {
		ffmpeg = await loadFFmpeg( file );

		const tempFileName = `tmp-${ uuidv4() }-${ fileName }`;

		await ffmpeg.run(
			...config,
			// Output filename. MUST be different from input filename.
			tempFileName
		);

		const data = ffmpeg.FS( 'readFile', tempFileName );

		// Delete file in MEMFS to free memory.
		ffmpeg.FS( 'unlink', tempFileName );

		// TODO: Consider using ffmpeg.setLogger() and look for messages such as "Decoder (codec av1) not found for input stream".
		// Allows throwing with more detailed error message.
		if ( ! data.buffer.byteLength ) {
			throw new Error( `File ${ fileName } could not be processed` );
		}

		return new File(
			[ new Blob( [ data.buffer ], { type: mimeType } ) ],
			fileName,
			{ type: mimeType }
		);
	} finally {
		try {
			// Also removes MEMFS to free memory.
			ffmpeg?.exit();
		} catch {
			// Not interested in errors here.
		}
	}
}

/**
 * Get FFmpeg scale argument to keep video within threshold.
 *
 * Adds 1px pad to width/height if they're not divisible by 2, which FFmpeg will complain about.
 *
 * See https://trac.ffmpeg.org/wiki/Scaling
 *
 * @param threshold Big video size threshold
 */
function getScaleArg( threshold: number ) {
	if ( ! threshold ) {
		return [];
	}

	return [
		'-vf',
		`scale='min(${ threshold },iw)':'min(${ threshold },ih)':'force_original_aspect_ratio=decrease',pad='width=ceil(iw/2)*2:height=ceil(ih/2)*2'`,
	];
}

/**
 * Transcodes a video using FFmpeg.
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
	const outputFileName = `${ basename }.${ getExtensionFromMimeType(
		mimeType
	) }`;
	return runFFmpegWithConfig(
		file,
		[
			// Input filename.
			'-i',
			file.name,
			// Set desired video codec.
			'-codec:v',
			VIDEO_CODEC[ mimeType ] || 'libx264',
			...getScaleArg( threshold ),
			...FFMPEG_CONFIG.FPS,
			...FFMPEG_CONFIG.FASTSTART,
			...FFMPEG_CONFIG.COLOR_PROFILE,
			...FFMPEG_CONFIG.PRESET,
		],
		mimeType,
		outputFileName
	);
}

/**
 * Mutes a video using FFmpeg while retaining the file type.
 *
 * @param file Original video file object.
 * @return Processed video file object.
 */
export async function muteVideo( file: File ): Promise< File > {
	return runFFmpegWithConfig(
		file,
		[
			// Input filename.
			'-i',
			file.name,
			// Preserve existing video codec.
			'-codec:v',
			'copy',
			// Ensure there is no audio.
			'-an',
		],
		file.type,
		file.name
	);
}

/**
 * Transcodes an audio file using FFmpeg.
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
	const outputFileName = `${ basename }.${ getExtensionFromMimeType(
		mimeType
	) }`;
	return runFFmpegWithConfig(
		file,
		[
			// Input filename.
			'-i',
			file.name,
			// Ensure there is no video.
			'-vn',
			// Set desired audio codec.
			'-codec:a',
			AUDIO_CODEC[ mimeType ] || 'libmp3lame',
		],
		mimeType,
		outputFileName
	);
}

/**
 * Extracts a video's first frame using FFmpeg.
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
	return runFFmpegWithConfig(
		file,
		[
			...FFMPEG_CONFIG.SEEK_TO_START,
			// Input filename.
			'-i',
			file.name,
			...FFMPEG_CONFIG.SINGLE_FRAME,
			...getScaleArg( threshold ),
			...FFMPEG_CONFIG.COLOR_PROFILE,
			...FFMPEG_CONFIG.PRESET,
		],
		'image/jpeg',
		outputFileName
	);
}

/**
 * Converts an animated GIF to a video using FFmpeg.
 *
 * @param file      Original GIF file object.
 * @param basename  GIF file name without extension.
 * @param mimeType  Desired mime type.
 * @param threshold Big video size threshold.
 * @return Converted video file object.
 */
export async function convertGifToVideo(
	file: File,
	basename: string,
	mimeType: string,
	threshold: number
): Promise< File > {
	return transcodeVideo( file, basename, mimeType, threshold );
}
