import { blobToFile, getFileBasename } from '@mexp/media-utils';

async function getVips() {
	// Ignore reason: Types in the published package haven't been updated yet.
	// @ts-ignore
	return window.Vips({
		// Disable dynamic modules, it doesn't work when wasm-vips is served from a CDN
		// https://github.com/kleisauke/wasm-vips/issues/35
		dynamicLibraries: [],
		// https://github.com/kleisauke/wasm-vips/issues/12#issuecomment-1067001784
		// https://github.com/kleisauke/wasm-vips/blob/789363e5b54d677b109bcdaf8353d283d81a8ee3/src/locatefile-cors-pre.js#L4
		workaroundCors: true,
	});
}

/**
 * Transcode an image using vips.
 *
 * @param file Original file object.
 * @return Processed file object.
 */
export async function convertImageToJpeg(file: File) {
	const vips = await getVips();
	let image = vips.Image.newFromBuffer(await file.arrayBuffer());
	const outBuffer = image.writeToBuffer('.jpeg', { Q: 75 });

	const fileName = `${getFileBasename(file.name)}.jpeg`;
	return blobToFile(
		new Blob([outBuffer], { type: 'image/jpeg' }),
		fileName,
		'image/jpeg'
	);
}
