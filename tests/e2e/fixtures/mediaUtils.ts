import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { copyFile, mkdtemp } from 'node:fs/promises';

import { v4 as uuidv4 } from 'uuid';
import type { Page, Locator } from '@playwright/test';

export class MediaUtils {
	page: Page;
	basePath: string;
	DEFAULT_IMAGE_PATH: string;

	constructor( { page } ) {
		this.page = page;
		this.basePath = join( __dirname, '..', 'assets' );

		this.DEFAULT_IMAGE_PATH = join(
			this.basePath,
			'wordpress-logo-512x512.png'
		);
	}

	async upload( inputElement: Locator, fileName?: string ) {
		const tmpDirectory = await mkdtemp(
			join( tmpdir(), 'gutenberg-test-image-' )
		);
		const newFileName = uuidv4();
		const filepath = fileName
			? join( this.basePath, fileName )
			: this.DEFAULT_IMAGE_PATH;
		const tmpFileName = join(
			tmpDirectory,
			`${ newFileName }${ extname( filepath ) }`
		);
		await copyFile( filepath, tmpFileName );

		await inputElement.setInputFiles( tmpFileName );

		return newFileName;
	}

	async getImageBuffer( url: string ) {
		const response = await this.page.request.get( url );
		return response.body();
	}
}
