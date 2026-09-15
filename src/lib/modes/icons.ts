import { IconCalendar, IconPercent, IconScale, IconTag, IconTagReverse, IconWallet } from '../../components/Icons'
import type { ModeId } from './types'

/** The glyph each mode is recognised by, in the history and basket lists. */
export const MODE_ICONS: Record<ModeId, typeof IconPercent> = {
  profit: IconPercent,
  sell: IconScale,
  discount: IconTag,
  rdiscount: IconTagReverse,
  installment: IconWallet,
  rinstallment: IconCalendar,
}
