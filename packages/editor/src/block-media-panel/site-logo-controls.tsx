/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import { useDispatch, useSelect } from '@wordpress/data';
import { type Settings, store as coreStore } from '@wordpress/core-data';
import type { BlockEditProps } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { useAttachment } from '../utils/hooks';
import { UploadIndicator } from './upload-indicator';
import { OptimizeMedia } from './optimize-media';
import { DebugInfo } from './debug-info';
import type { SiteLogoBlock } from '../types';

type SiteLogoControlsProps = SiteLogoBlock &
	Pick< BlockEditProps< SiteLogoBlock[ 'attributes' ] >, 'setAttributes' >;

export function SiteLogoControls( { attributes }: SiteLogoControlsProps ) {
	const { siteLogoId } = useSelect( ( select ) => {
		const { canUser, getEditedEntityRecord } = select( coreStore );
		const _canUserEdit = canUser( 'update', 'settings' );
		const siteSettings = _canUserEdit
			? ( getEditedEntityRecord( 'root', 'site', undefined ) as Settings )
			: undefined;
		const _siteLogoId = _canUserEdit ? siteSettings?.site_logo : undefined;

		return {
			siteLogoId: _siteLogoId,
		};
	}, [] );

	const { editEntityRecord } = useDispatch( coreStore );
	const attachment = useAttachment( siteLogoId );

	if ( ! siteLogoId || ! attachment ) {
		return null;
	}

	function onChange( media: Partial< Attachment > ) {
		if ( ! media || ! media.id ) {
			return;
		}

		// `shouldForceSync` is used to force syncing when the attribute
		// may not have updated yet.
		if ( attributes.shouldSyncIcon ) {
			void editEntityRecord( 'root', 'site', undefined, {
				site_icon: media.id,
			} );
		}

		void editEntityRecord( 'root', 'site', undefined, {
			site_logo: media.id,
		} );
	}

	return (
		<>
			<UploadIndicator id={ siteLogoId } />
			<OptimizeMedia
				id={ siteLogoId }
				url={ attachment.source_url }
				onSuccess={ onChange }
			/>
			<DebugInfo id={ siteLogoId } />
		</>
	);
}
