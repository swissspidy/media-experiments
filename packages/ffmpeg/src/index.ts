import { v4 as uuidv4 } from 'uuid';
import { blobToFile, getFileBasename } from '@mexp/media-utils';
import type { FFmpeg } from '@ffmpeg/ffmpeg';

// import { MAX_VIDEO_RESOLUTION } from './constants';

const FFMPEG_CONFIG = {
	CODEC: [
		// Use H.264 video codec.
		'-vcodec',
		'libx264',
	],
	SCALE: [
		// TODO: Make configurable by user? Still need to retain original.
		// See https://github.com/swissspidy/media-experiments/issues/3
		// Scale down to 1080p to keep file size small.
		// See https://trac.ffmpeg.org/wiki/Scaling
		// Adds 1px pad to width/height if they're not divisible by 2, which FFmpeg will complain about.
		// '-vf',
		// `scale='min(${ MAX_VIDEO_RESOLUTION[ 0 ] },iw)':'min(${ MAX_VIDEO_RESOLUTION[ 1 ] },ih)':'force_original_aspect_ratio=decrease',pad='width=ceil(iw/2)*2:height=ceil(ih/2)*2'`,
	],
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

const FFMPEG_SHARED_CONFIG = [
	...FFMPEG_CONFIG.CODEC,
	...FFMPEG_CONFIG.SCALE,
	...FFMPEG_CONFIG.FPS,
	...FFMPEG_CONFIG.FASTSTART,
	...FFMPEG_CONFIG.COLOR_PROFILE,
	...FFMPEG_CONFIG.PRESET,
];

const ffmpegCoreUrl = FFMPEG_CDN_URL;

const isDevelopment =
	typeof process !== 'undefined' &&
	process.env &&
	process.env.NODE_ENV !== 'production';

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
 * Run FFmpeg with a given config.
 *
 * @param file     Input file object.
 * @param config   FFmpeg config arguments.
 * @param mimeType Output mime type.
 * @param fileName Output file name.
 * @return Output file object.
 */
export async function runFFmpegWithConfig(
	file: File,
	config: string[],
	mimeType: string,
	fileName: string
) {
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

		return blobToFile(
			new Blob( [ data.buffer ], { type: mimeType } ),
			fileName,
			mimeType
		);
	} catch ( err ) {
		// eslint-disable-next-line no-console -- We want to surface this error.
		console.error( err );
		throw err;
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
 * Transcode a video using FFmpeg.
 *
 * @param file Original video file object.
 * @return Processed video file object.
 */
export async function transcodeVideo( file: File ) {
	const outputFileName = `${ getFileBasename( file.name ) }.mp4`;
	return runFFmpegWithConfig(
		file,
		[
			// Input filename.
			'-i',
			file.name,
			...FFMPEG_SHARED_CONFIG,
		],
		'video/mp4',
		outputFileName
	);
}

/**
 * Mute a video using FFmpeg.
 *
 * @param file Original video file object.
 * @return Processed video file object.
 */
export async function muteVideo( file: File ) {
	const outputFileName = `${ getFileBasename( file.name ) }.mp4`;
	return runFFmpegWithConfig(
		file,
		[
			// Input filename.
			'-i',
			file.name,
			'-vcodec',
			'copy',
			'-an',
		],
		'video/mp4',
		outputFileName
	);
}

/**
 * Transcode an audio file using FFmpeg.
 *
 * @param file Original audio file object.
 * @return Processed audio file object.
 */
export async function transcodeAudio( file: File ) {
	const outputFileName = `${ getFileBasename( file.name ) }.mp3`;
	return runFFmpegWithConfig(
		file,
		[
			// Input filename.
			'-i',
			file.name,
			...FFMPEG_SHARED_CONFIG,
		],
		'audio/mp3',
		outputFileName
	);
}

/**
 * Extract a video's first frame using FFmpeg.
 *
 * Note: Exact seeking is not possible in most formats.
 *
 * @param file Original video file object.
 * @return File object for the video frame.
 */
export async function getFirstFrameOfVideo( file: File ) {
	const outputFileName = `${ getFileBasename( file.name ) }-poster.jpeg`;
	return runFFmpegWithConfig(
		file,
		[
			...FFMPEG_CONFIG.SEEK_TO_START,
			// Input filename.
			'-i',
			file.name,
			...FFMPEG_CONFIG.SINGLE_FRAME,
			...FFMPEG_CONFIG.SCALE,
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
 * @param file Original GIF file object.
 * @return Converted video file object.
 */
export async function convertGifToVideo( file: File ) {
	return transcodeVideo( file );
}
