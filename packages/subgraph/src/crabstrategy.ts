import { Address, BigInt, log } from "@graphprotocol/graph-ts"
import {
  CrabStrategy,
  Deposit,
  Withdraw,
  FlashDeposit,
  FlashWithdraw,
  Transfer,
  HedgeOnUniswap,
  Hedge
} from "../generated/CrabStrategy/CrabStrategy"
import { CrabStrategyTx } from "../generated/schema"

function loadOrCreateTx(id: string): CrabStrategyTx {
  const strategy = CrabStrategyTx.load(id)
  if (strategy) return strategy

  return new CrabStrategyTx(id)
}

export function handleDeposit(event: Deposit): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.wSqueethAmount = event.params.wSqueethAmount
  strategyTx.lpAmount = event.params.lpAmount
  strategyTx.ethAmount = event.transaction.value
  strategyTx.owner = event.transaction.from
  strategyTx.timestamp = event.block.timestamp
  strategyTx.type = 'DEPOSIT'
  strategyTx.save()
}

export function handleWithdraw(event: Withdraw): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.wSqueethAmount = event.params.wSqueethAmount
  strategyTx.lpAmount = event.params.crabAmount
  strategyTx.ethAmount = event.params.ethWithdrawn
  strategyTx.owner = event.transaction.from
  strategyTx.timestamp = event.block.timestamp
  strategyTx.type = 'WITHDRAW'
  strategyTx.save()
}

export function handleFlashDeposit(event: FlashDeposit): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.wSqueethAmount = event.params.tradedAmountOut
  strategyTx.ethAmount = event.transaction.value
  strategyTx.owner = event.transaction.from
  strategyTx.timestamp = event.block.timestamp
  strategyTx.type = 'FLASH_DEPOSIT'
  strategyTx.save()
}

export function handleFlashWithdraw(event: FlashWithdraw): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.wSqueethAmount = event.params.wSqueethAmount
  strategyTx.lpAmount = event.params.crabAmount
  strategyTx.owner = event.transaction.from
  strategyTx.timestamp = event.block.timestamp
  strategyTx.type = 'FLASH_WITHDRAW'
  strategyTx.save()
}

export function handleHedgeOnUniswap(event: HedgeOnUniswap): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.type = 'HEDGE_ON_UNISWAP'
  strategyTx.wSqueethHedgeTargetAmount = event.params.wSqueethHedgeTargetAmount
  strategyTx.ethHedgeTargetAmount = event.params.ethHedgetargetAmount
  strategyTx.auctionPrice = event.params.auctionPrice
  strategyTx.isSellingSqueeth = event.params.auctionType
  strategyTx.owner = event.params.hedger
  strategyTx.timestamp = event.block.timestamp
  strategyTx.save()
}

export function handleHedge(event: Hedge): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  strategyTx.type = 'HEDGE'
  strategyTx.wSqueethHedgeTargetAmount = event.params.wSqueethHedgeTargetAmount
  strategyTx.ethHedgeTargetAmount = event.params.ethHedgetargetAmount
  strategyTx.auctionPrice = event.params.auctionPrice
  strategyTx.isSellingSqueeth = event.params.auctionType
  strategyTx.hedgerPrice = event.params.hedgerPrice
  strategyTx.owner = event.params.hedger
  strategyTx.timestamp = event.block.timestamp
  strategyTx.save()
}

export function handleTransfer(event: Transfer): void {
  const strategyTx = loadOrCreateTx(event.transaction.hash.toHex())
  log.info("Handling transfer {}, value {}", [event.params.from.toHex(), (event.params.from.toHex().toLowerCase() == '0x0000000000000000000000000000000000000000').toString()])
  if (event.params.from.toHex().toLowerCase() == '0x0000000000000000000000000000000000000000') {
    log.info("Transferring data from: {} to: {} value: {}", [event.params.from.toHex(), event.params.to.toHex(), event.params.value.toString()])
    strategyTx.lpAmount = event.params.value
    strategyTx.save()
  }
}