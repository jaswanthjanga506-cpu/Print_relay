import { ApiError } from '../utils/ApiError.js';

export const PRICING_NOTE =
  'Each selected page is charged as one printed side. Double-sided printing does not reduce the price.';

/**
 * Total = selectedPages x copies x rate + bindingFee x copies   (all integer paise)
 */
export function computePrice({ shop, printType, selectedPages, copies, binding }) {
  const { services, pricing } = shop;
  let printRatePaise;

  if (printType === 'BW') {
    if (!services?.bw || !(pricing?.bwPerSidePaise > 0)) {
      throw ApiError.unprocessable('This shop does not offer black & white printing', undefined, 'SERVICE_UNAVAILABLE');
    }
    printRatePaise = pricing.bwPerSidePaise;
  } else if (printType === 'COLOUR') {
    if (!services?.colour || !(pricing?.colourPerSidePaise > 0)) {
      throw ApiError.unprocessable('This shop does not offer colour printing', undefined, 'SERVICE_UNAVAILABLE');
    }
    printRatePaise = pricing.colourPerSidePaise;
  } else {
    throw ApiError.badRequest('Unknown printing type');
  }

  let bindingFeePaise = 0;
  if (binding === 'SPIRAL') {
    if (!services?.spiralBinding) throw ApiError.unprocessable('This shop does not offer spiral binding', undefined, 'SERVICE_UNAVAILABLE');
    bindingFeePaise = pricing.spiralBindingPaise || 0;
  }

  const printingTotalPaise = selectedPages * copies * printRatePaise;
  const bindingTotalPaise = bindingFeePaise * copies;
  const totalPaise = printingTotalPaise + bindingTotalPaise;
  if (![printRatePaise, bindingFeePaise, printingTotalPaise, bindingTotalPaise, totalPaise].every(Number.isSafeInteger)) {
    throw ApiError.badRequest('Price could not be calculated');
  }

  return { printRatePaise, bindingFeePaise, selectedPages, copies, printingTotalPaise, bindingTotalPaise, totalPaise };
}
