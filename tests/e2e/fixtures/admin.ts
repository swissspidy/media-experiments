/**
 * WordPress dependencies
 */
import { Admin as BaseAdmin } from '@wordpress/e2e-test-utils-playwright';

interface NewPostOptions {
	postType?: string;
	title?: string;
	content?: string;
	excerpt?: string;
	showWelcomeGuide?: boolean;
	fullscreenMode?: boolean;
	showMediaWelcomeGuide?: boolean;
}

export class Admin extends BaseAdmin {
	createNewPost: ( options?: NewPostOptions ) => Promise< void > = async (
		options: NewPostOptions = {}
	) => {
		const query = new URLSearchParams();
		const { postType, title, content, excerpt } = options;

		if ( postType ) {
			query.set( 'post_type', postType );
		}
		if ( title ) {
			query.set( 'post_title', title );
		}
		if ( content ) {
			query.set( 'content', content );
		}
		if ( excerpt ) {
			query.set( 'excerpt', excerpt );
		}

		await this.visitAdminPage( 'post-new.php', query.toString() );

		await this.editor.setPreferences( 'core/edit-post', {
			welcomeGuide: options.showWelcomeGuide ?? false,
			fullscreenMode: options.fullscreenMode ?? false,
		} );

		// @ts-ignore
		await this.editor.setPreferences( 'media-experiments/preferences', {
			welcomeGuide: options.showMediaWelcomeGuide ?? false,
		} );
	};
}
