/**
 * WordPress dependencies
 */
import {
	createPortal,
	useLayoutEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { registerPlugin } from '@wordpress/plugins';
import { store as coreStore, type Type } from '@wordpress/core-data';
import { store as editorStore } from '@wordpress/editor';

/**
 * Internal dependencies
 */
import { UploadStatusIndicator } from './indicator';

function WrappedUploadStatusIndicator() {
	const root = useRef< HTMLDivElement | null >( null );
	const referenceNode = useRef< HTMLDivElement | null >( null );

	const [ , setHasNode ] = useState( false );

	const { isSaveable, isViewable } = useSelect( ( select ) => {
		// @ts-ignore
		const currentPostType = select( coreStore ).getPostType(
			select( editorStore ).getCurrentPostType()
		) as Type | null;

		return {
			isSaveable:
				select( editorStore ).isEditedPostSaveable() ||
				select( editorStore ).hasNonPostEntityChanges(),
			isViewable: Boolean( currentPostType?.viewable ),
		};
	}, [] );

	useLayoutEffect( () => {
		// The upload status indicator should always be inserted right before any other buttons.
		referenceNode.current = document.querySelector(
			'.editor-header__settings, .edit-widgets-header__actions'
		);

		if ( referenceNode.current ) {
			if ( ! root.current ) {
				root.current = document.createElement( 'div' );
				root.current.className = 'media-experiments-upload-status';
			}

			referenceNode.current.prepend( root.current );

			setHasNode( true );
		}

		return () => {
			if ( referenceNode.current && root.current ) {
				referenceNode.current.removeChild( root.current );
				referenceNode.current = null;
				setHasNode( false );
			}
		};

		// The button should be "refreshed" whenever settings in the editor header are re-rendered.
		// The following properties may indicate a change in the toolbar layout:
		// - Viewable property gets defined once the toolbar has been rendered.
		// - When saveable property changes, the toolbar is reshuffled heavily.
	}, [ isSaveable, isViewable ] );

	return root.current
		? createPortal( <UploadStatusIndicator />, root.current )
		: null;
}

registerPlugin( 'media-experiments-upload-status', {
	render: WrappedUploadStatusIndicator,
} );
