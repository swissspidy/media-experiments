/*
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * External dependencies
 */
import type { DecodeResult } from 'libheif-js';

/**
 * Internal dependencies
 */
import {
	bufferToBlob,
	getExtensionFromMimeType,
	getFileBasename,
	isHeifImage,
} from './utils';
import { blobToFile } from '../utils';

function getDimensions(image: DecodeResult) {
	const width = image.get_width();
	const height = image.get_height();

	return { width, height };
}

async function decodeImage(image: DecodeResult) {
	const dimensions = getDimensions(image);
	const { width, height } = dimensions;

	return new Promise<ArrayBuffer>((resolve, reject) => {
		image.display(
			{
				data: new Uint8ClampedArray(width * height * 4),
				width,
				height,
				colorSpace: 'srgb',
			},
			(result: ImageData | null) => {
				if (!result) {
					reject(new Error('HEIF processing error'));
				} else {
					resolve(result.data.buffer);
				}
			}
		);
	});
}

export async function transcodeHeifImage(
	file: File,
	type?: 'image/jpeg' | 'image/png' | 'image/webp',
	quality?: number
) {
	const inputBuffer = await file.arrayBuffer();

	if (!isHeifImage(inputBuffer)) {
		throw new TypeError('Not a valid HEIF image 1');
	}

	const decoder = new window.libheif.HeifDecoder();

	// Image can have multiple frames, thus it's an array.
	// For now, only decode the first frame.

	const imagesArr = decoder.decode(new Uint8Array(inputBuffer));

	if (!imagesArr.length) {
		throw new TypeError('Not a valid HEIF image');
	}

	const resultBuffer = await decodeImage(imagesArr[0]);
	const dimensions = getDimensions(imagesArr[0]);

	let blob = await bufferToBlob(
		resultBuffer,
		dimensions.width,
		dimensions.height,
		type,
		quality
	);

	// Safari does not support WebP and falls back to PNG.
	// Use JPEG instead of PNG in that case.
	if (type === 'image/webp' && blob.type !== 'image/webp') {
		blob = await bufferToBlob(
			resultBuffer,
			dimensions.width,
			dimensions.height,
			'image/jpeg',
			quality
		);
	}

	if (!blob) {
		throw new Error('HEIF processing error');
	}

	return blobToFile(
		blob,
		`${getFileBasename(file.name)}.${getExtensionFromMimeType(blob.type)}`,
		blob.type
	);
}
