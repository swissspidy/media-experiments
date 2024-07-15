import type {
	OnChangeHandler,
	OnErrorHandler,
	CreateSideloadFile,
	RestAttachment,
} from './types';
import { sideloadToServer } from './sideloadToServer';

interface SideloadMediaArgs {
	// Additional data to include in the request.
	additionalData?: CreateSideloadFile;
	// File to sideload.
	file: File;
	// Attachment ID.
	attachmentId: RestAttachment[ 'id' ];
	// Function called when an error happens.
	onError?: OnErrorHandler;
	// Function called each time a file or a temporary representation of the file is available.
	onFileChange?: OnChangeHandler;
	// Abort signal.
	signal?: AbortSignal;
}

/**
 * Uploads a file to the server without creating an attachment.
 *
 * @param {Object} $0                Parameters object passed to the function.
 * @param          $0.file           Media File to Save.
 * @param          $0.attachmentId   Parent attachment ID.
 * @param          $0.additionalData Additional data to include in the request.
 * @param          $0.signal         Abort signal.
 * @param          $0.onFileChange
 */
export async function sideloadMedia( {
	file,
	attachmentId,
	additionalData = {},
	signal,
	onFileChange,
}: SideloadMediaArgs ) {
	// TODO: File validation etc.

	const attachment = await sideloadToServer(
		file,
		attachmentId,
		additionalData,
		signal
	);
	return onFileChange?.( [ attachment ] );
}
