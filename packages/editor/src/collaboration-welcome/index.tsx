/**
 * WordPress dependencies
 */
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import { CollaborationWelcomeModal } from './collaboration-welcome-modal';

function CollaborationWelcomePlugin() {
	return <CollaborationWelcomeModal />;
}

registerPlugin( 'media-experiments-collaboration-welcome', {
	render: CollaborationWelcomePlugin,
} );
