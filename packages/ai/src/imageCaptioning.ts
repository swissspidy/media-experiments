/**
 * External dependencies
 */
import {
	env,
	Florence2ForConditionalGeneration,
	AutoProcessor,
	AutoTokenizer,
	RawImage,
	type Tensor,
	PreTrainedModel,
	Processor,
	PreTrainedTokenizer,
} from '@huggingface/transformers';

let model: PreTrainedModel;
let processor: Processor;
let tokenizer: PreTrainedTokenizer;

async function loadModel() {
	env.allowLocalModels = false;
	env.allowRemoteModels = true;
	// Could be 'verbose', 'info', 'warning', 'error', 'fatal'.
	env.backends.onnx.logLevel = 'fatal';
	env.backends.onnx.wasm.proxy = false;
	// Workaround since we're using cross-origin isolation and are already within a worker.
	env.backends.onnx.wasm.numThreads = 1;

	const modelId = 'onnx-community/Florence-2-base-ft';
	model = await Florence2ForConditionalGeneration.from_pretrained( modelId, {
		dtype: 'fp32',
		device: 'webgpu',
	} );
	processor = await AutoProcessor.from_pretrained( modelId );
	tokenizer = await AutoTokenizer.from_pretrained( modelId );
}

/**
 * Generate a caption for a given URL.
 *
 * @param url  Image URL.
 * @param task Task to perform, determines how detailed the caption will be.
 */
export async function generateCaption(
	url: string,
	task:
		| '<CAPTION>'
		| '<DETAILED_CAPTION>'
		| '<MORE_DETAILED_CAPTION>' = '<CAPTION>'
) {
	if ( ! processor || ! model || ! tokenizer ) {
		await loadModel();
	}

	if ( ! processor || ! model || ! tokenizer ) {
		return;
	}

	// Load image and prepare vision inputs
	const image = await RawImage.fromURL( url );
	const visionInputs = await processor( image );

	// @ts-ignore
	const prompts = processor.construct_prompts( task );
	const textInputs = tokenizer( prompts );

	// Generate text
	const generatedIds = ( await model.generate( {
		...textInputs,
		...visionInputs,
		// eslint-disable-next-line camelcase
		max_new_tokens: 100,
	} ) ) as Tensor;

	// Decode generated text
	const generatedText = tokenizer.batch_decode( generatedIds, {
		// eslint-disable-next-line camelcase
		skip_special_tokens: false,
	} )[ 0 ];

	// Post-process the generated text
	// @ts-ignore
	const result = processor.post_process_generation(
		generatedText,
		task,
		image.size
	);

	return result[ task ];
}
