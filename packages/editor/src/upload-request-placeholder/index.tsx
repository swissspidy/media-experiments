/**
 * External dependencies
 */
import { store as interfaceStore } from '@mexp/interface';
import {
transformAttachment,
type Attachment,
type RestAttachment,
} from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import { createHigherOrderComponent } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';
import { useSelect, useDispatch } from '@wordpress/data';
import { type Post, store as coreStore } from '@wordpress/core-data';
import { useEffect, useState } from '@wordpress/element';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import type { MediaPanelProps } from '../types';
import { InlinePlaceholder } from '../block-media-panel/upload-requests/placeholder';

const SUPPORTED_BLOCKS = [
'core/image',
'core/audio',
'core/video',
'core/gallery',
];

const UPLOAD_REQUEST_CHECK_INTERVAL = 5; // Seconds.
const UPLOAD_REQUEST_MAX_LIFETIME = 15 * 60; // Seconds.

const addUploadRequestPlaceholder = createHigherOrderComponent(
( BlockEdit ) => ( props: MediaPanelProps ) => {
const { closeModal } = useDispatch( interfaceStore );
// @ts-ignore
const { deleteEntityRecord, invalidateResolution } =
useDispatch( coreStore );
const { createSuccessNotice, createErrorNotice } =
useDispatch( noticesStore );
const { unlockPostSaving } = useDispatch( editorStore );

const {
isInUploadMode,
getEntityRecords,
uploadRequestForBlock,
} = useSelect(
( select ) => {
const modalName = `media-experiments/upload-request-${ props.clientId }`;
const isActive =
select( interfaceStore ).isModalActive( modalName );

// Get the upload request post if we're in upload mode
let uploadRequest: Post | null = null;
if ( isActive ) {
// Try to find the upload request by checking for recent ones
// This is a workaround since we don't have a direct way to get it
const requests: Post[] | null =
select( coreStore ).getEntityRecords(
'postType',
'mexp-upload-request',
{
status: 'publish',
per_page: 10,
orderby: 'date',
order: 'desc',
}
);
uploadRequest = requests?.[ 0 ] || null;
}

return {
isInUploadMode: isActive,
getEntityRecords: select( coreStore ).getEntityRecords,
uploadRequestForBlock: uploadRequest,
};
},
[ props.clientId ]
);

const [ uploadRequest, setUploadRequest ] = useState< Post | null >(
uploadRequestForBlock
);

useEffect( () => {
if ( uploadRequestForBlock ) {
setUploadRequest( uploadRequestForBlock );
}
}, [ uploadRequestForBlock ] );

const uploadRequestSlug = uploadRequest ? uploadRequest.slug : null;

async function deleteUploadRequest() {
if ( ! uploadRequestSlug ) {
return;
}
try {
await deleteEntityRecord(
'postType',
'mexp-upload-request',
uploadRequestSlug,
{},
{ throwOnError: true }
);
} catch {
// Do nothing.
}
}

function onCancel() {
void deleteUploadRequest();
void closeModal();
void unlockPostSaving( 'media-experiments/upload-request' );
}

// Poll for uploaded media
useEffect( () => {
if ( ! uploadRequestSlug || ! isInUploadMode ) {
return undefined;
}

const timeout = setInterval( () => {
void invalidateResolution( 'getEntityRecords', [
'postType',
'attachment',
{
upload_request: uploadRequestSlug,
context: 'edit',
},
] );

const attachments: RestAttachment[] | null =
getEntityRecords( 'postType', 'attachment', {
upload_request: uploadRequestSlug,
context: 'edit',
} );

if ( attachments && attachments.length > 0 ) {
// Get the onInsert callback from the block controls
// For now, we'll just close the modal and let the block controls handle it
void deleteUploadRequest();
void closeModal();
void unlockPostSaving( 'media-experiments/upload-request' );
void createSuccessNotice(
__(
'Media successfully uploaded.',
'media-experiments'
),
{
type: 'snackbar',
}
);

clearInterval( timeout );
}
}, UPLOAD_REQUEST_CHECK_INTERVAL * 1000 );

return () => clearInterval( timeout );
}, [
uploadRequestSlug,
isInUploadMode,
invalidateResolution,
getEntityRecords,
deleteUploadRequest,
closeModal,
unlockPostSaving,
createSuccessNotice,
] );

// Handle expiry
useEffect( () => {
if ( ! uploadRequestSlug || ! isInUploadMode ) {
return undefined;
}

const timeout = setTimeout( () => {
void deleteUploadRequest();
void closeModal();
void unlockPostSaving( 'media-experiments/upload-request' );
void createErrorNotice(
__( 'Upload expired.', 'media-experiments' ),
{
type: 'snackbar',
}
);
}, UPLOAD_REQUEST_MAX_LIFETIME * 1000 );

return () => clearTimeout( timeout );
}, [
uploadRequestSlug,
isInUploadMode,
deleteUploadRequest,
closeModal,
unlockPostSaving,
createErrorNotice,
] );

if ( ! SUPPORTED_BLOCKS.includes( props.name ) ) {
return <BlockEdit { ...props } />;
}

if ( ! isInUploadMode ) {
return <BlockEdit { ...props } />;
}

// The InlinePlaceholder component will render the QR code and URL
return (
<InlinePlaceholder
uploadRequest={ uploadRequest }
onCancel={ onCancel }
/>
);
},
'withUploadRequestPlaceholder'
);

addFilter(
'editor.BlockEdit',
'media-experiments/add-upload-request-placeholder',
addUploadRequestPlaceholder,
5
);
