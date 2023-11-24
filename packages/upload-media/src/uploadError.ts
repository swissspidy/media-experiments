interface UploadErrorArgs {
	code: string;
	message: string;
	file: File;
}

export class UploadError extends Error {
	code: string;
	file: File;

	constructor( { code, message, file }: UploadErrorArgs ) {
		super( message );
		this.code = code;
		this.file = file;
	}
}
