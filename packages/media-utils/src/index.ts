export { ImageFile } from './imageFile';

/**
 * Returns file basename without extension.
 *
 * For example, turns "my-awesome-file.jpeg" into "my-awesome-file".
 *
 * @param name File name.
 * @return File basename.
 */
export function getFileBasename( name: string ): string {
	return name.includes( '.' )
		? name.split( '.' ).slice( 0, -1 ).join( '.' )
		: name;
}
