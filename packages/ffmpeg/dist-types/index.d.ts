/**
 * Run FFmpeg with a given config.
 *
 * @param file     Input file object.
 * @param config   FFmpeg config arguments.
 * @param mimeType Output mime type.
 * @param fileName Output file name.
 * @return Output file object.
 */
export declare function runFFmpegWithConfig(
	file: File,
	config: string[],
	mimeType: string,
	fileName: string
): Promise<File>;
/**
 * Transcode a video using FFmpeg.
 *
 * @param file Original video file object.
 * @return Processed video file object.
 */
export declare function transcodeVideo(file: File): Promise<File>;
/**
 * Transcode an image using FFmpeg.
 *
 * @param file Original video file object.
 * @return Processed video file object.
 */
export declare function transcodeImage(file: File): Promise<File>;
/**
 * Mute a video using FFmpeg.
 *
 * @param file Original video file object.
 * @return Processed video file object.
 */
export declare function muteVideo(file: File): Promise<File>;
/**
 * Transcode an audio file using FFmpeg.
 *
 * @param file Original audio file object.
 * @return Processed audio file object.
 */
export declare function transcodeAudio(file: File): Promise<File>;
/**
 * Extract a video's first frame using FFmpeg.
 *
 * Note: Exact seeking is not possible in most formats.
 *
 * @param file Original video file object.
 * @return File object for the video frame.
 */
export declare function getFirstFrameOfVideo(file: File): Promise<File>;
/**
 * Converts an animated GIF to a video using FFmpeg.
 *
 * @param file Original GIF file object.
 * @return Converted video file object.
 */
export declare function convertGifToVideo(file: File): Promise<File>;
//# sourceMappingURL=index.d.ts.map
