/**
 * External dependencies
 */
import {
	ReactCompareSlider,
	ReactCompareSliderImage,
} from 'react-compare-slider';
import type { RestAttachment } from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import {
	Button,
	Modal,
	RangeControl,
	ToggleControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import {
	createInterpolateElement,
	useCallback,
	useState,
} from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEntityRecord } from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import './editor.css';

const numberFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'unit',
	unit: 'byte',
	unitDisplay: 'narrow',
	roundingPriority: 'lessPrecision',
	maximumSignificantDigits: 2,
	maximumFractionDigits: 2,
} );

const diffFormatter = Intl.NumberFormat( 'en', {
	notation: 'compact',
	style: 'percent',
	maximumFractionDigits: 2,
} );

interface ApprovalDialogProps {
	id: number;
}

export function ApprovalDialog( { id }: ApprovalDialogProps ) {
	const { record: post } = useEntityRecord< RestAttachment | null >(
		'postType',
		'attachment',
		id
	);
	const { isPendingApproval, comparison, item } = useSelect(
		( select ) => ( {
			// This allows showing only one approval modal at a time if there
			// are multiple pending items.
			isPendingApproval: id
				? select( uploadStore ).isPendingApprovalByAttachmentId( id )
				: false,
			comparison: id
				? select( uploadStore ).getComparisonDataForApproval( id )
				: null,
			item: id ? select( uploadStore ).getItemByAttachmentId( id ) : null,
		} ),
		[ id ]
	);

	const { rejectApproval, grantApproval, reoptimizeItem } =
		useDispatch( uploadStore );
	const [ , setOpen ] = useState( false );
	const [ showAdvanced, setShowAdvanced ] = useState( false );
	const [ quality, setQuality ] = useState(
		() => comparison?.currentQuality || 82
	);
	const [ isReoptimizing, setIsReoptimizing ] = useState( false );

	const closeModal = () => setOpen( false );
	const onApprove = () => {
		closeModal();
		void grantApproval( id );
	};

	const onReject = () => {
		closeModal();
		void rejectApproval( id );
	};

	const handleQualityChange = useCallback(
		async ( newQuality: number | undefined ) => {
			if ( ! newQuality || ! item || isReoptimizing ) {
				return;
			}

			setQuality( newQuality );
			setIsReoptimizing( true );

			try {
				await reoptimizeItem( item.id, {
					outputQuality: newQuality,
				} );
			} finally {
				setIsReoptimizing( false );
			}
		},
		[ item, reoptimizeItem, isReoptimizing ]
	);

	if ( ! post || ! isPendingApproval || ! comparison ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'Compare media quality', 'media-experiments' ) }
			onRequestClose={ onReject }
			size="medium"
		>
			<div className="mexp-comparison-modal__labels">
				<p>
					{ sprintf(
						/* translators: %s: file size. */
						__( 'Old version: %s', 'media-experiments' ),
						numberFormatter.format( comparison.oldSize )
					) }
				</p>
				<p>
					{ sprintf(
						/* translators: %s: file size. */
						__( 'New version: %s', 'media-experiments' ),
						numberFormatter.format( comparison.newSize )
					) }
				</p>
			</div>
			<p>
				{ createInterpolateElement(
					comparison.sizeDiff < 0
						? sprintf(
								/* translators: %s: file size decrease in percent. */
								__(
									'The new version is <b>%s smaller</b>!',
									'media-experiments'
								),
								diffFormatter.format( comparison.sizeDiff )
						  )
						: sprintf(
								/* translators: %s: file size increase in percent. */
								__(
									'The new version is <b>%s bigger</b> :(',
									'media-experiments'
								),
								diffFormatter.format( comparison.sizeDiff )
						  ),
					{
						b: <b />,
					}
				) }
			</p>
			<div className="mexp-comparison-modal__slider">
				<ReactCompareSlider
					itemOne={
						<ReactCompareSliderImage
							src={ comparison.oldUrl }
							alt={ __(
								'Original version',
								'media-experiments'
							) }
						/>
					}
					itemTwo={
						<ReactCompareSliderImage
							src={ comparison.newUrl }
							alt={ __(
								'Optimized version',
								'media-experiments'
							) }
						/>
					}
				/>
			</div>
			<div className="mexp-comparison-modal__advanced">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Advanced options', 'media-experiments' ) }
					checked={ showAdvanced }
					onChange={ setShowAdvanced }
				/>
				{ showAdvanced && (
					<div className="mexp-comparison-modal__quality-control">
						<RangeControl
							__nextHasNoMarginBottom
							label={ __( 'Quality', 'media-experiments' ) }
							value={ quality }
							onChange={ handleQualityChange }
							min={ 1 }
							max={ 100 }
							disabled={ isReoptimizing }
							help={ __(
								'Adjust the quality to find the best balance between file size and visual fidelity.',
								'media-experiments'
							) }
						/>
						{ isReoptimizing && (
							<p className="mexp-comparison-modal__reoptimizing-notice">
								{ __(
									'Reoptimizing image…',
									'media-experiments'
								) }
							</p>
						) }
					</div>
				) }
			</div>
			<div className="mexp-comparison-modal__buttons">
				<Button variant="secondary" onClick={ onReject }>
					{ __( 'Cancel', 'media-experiments' ) }
				</Button>
				<Button variant="primary" onClick={ onApprove }>
					{ __( 'Use optimized version', 'media-experiments' ) }
				</Button>
			</div>
		</Modal>
	);
}
