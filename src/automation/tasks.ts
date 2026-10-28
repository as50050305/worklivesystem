/** 註冊每日檢查任務（在 App 啟動時 import 一次） */
import { clientsRepo } from '@/data/repositories/clientsRepo'
import { optionsRepo } from '@/data/repositories/optionsRepo'
import { invalidateTable } from '@/data/queryClient'
import { registerDailyTask } from './dailyCheck'

// 規則 A-5：冷卻期滿的客戶改為「可重新聯絡」
registerDailyTask({
  name: 'client-unfreeze',
  run: async (today) => {
    const n = await clientsRepo.unfreezeDue(today, await optionsRepo.listAll())
    if (n > 0) invalidateTable('clients')
  },
})
