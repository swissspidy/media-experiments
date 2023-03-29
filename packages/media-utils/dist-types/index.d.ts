export declare function getMediaTypeFromMimeType(mimeType: string): string;
/**
 * Get the file extension for a given mime type.
 *
 * Good enough for the use case here, but ideally this
 * would come from a mime database.
 *
 * @param mimeType Mime type.
 * @return File extension.
 */
export declare function getExtensionFromMimeType(
	mimeType: string
): 'jpeg' | 'png' | 'webp' | 'unknown';
export declare function getFileBasename(name: string): string;
export declare function blobToFile(
	blob: Blob,
	filename: string,
	type: string
): File;
export declare function getCanvasBlob(
	canvasEl: HTMLCanvasElement,
	type?: 'image/jpeg' | 'image/png' | 'image/webp',
	quality?: number
): Promise<Blob>;
export declare function bufferToBlob(
	buffer: ArrayBuffer,
	width: number,
	height: number,
	type?: 'image/jpeg' | 'image/png' | 'image/webp',
	quality?: number
): Promise<Blob>;
//# sourceMappingURL=index.d.ts.map
