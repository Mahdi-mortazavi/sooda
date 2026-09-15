/** The surface docs-examples.mjs needs, re-exported so esbuild has a single entry point. */
export { calcFromProfitPercent, calcFromSellingPrice, calcDiscount, calcReverseDiscount } from '../src/lib/calc'
export {
  INFLATION_DEFAULT,
  monthlyRateFromPercent,
  replacementCost,
  realProfitPercent,
  suggestedPrice,
  profitStatus,
} from '../src/lib/inflation'
export { calcInstallmentForward, calcInstallmentReverse } from '../src/lib/installment'
export { productStatus } from '../src/lib/products'
export { roundUpTo } from '../src/lib/rounding'
export { addMonths } from '../src/lib/dates'
export { productRate } from '../src/lib/rates'
export { FALLBACK_RATES } from '../src/lib/rates/load'
