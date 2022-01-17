import BigNumber from 'bignumber.js'
import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pool, Route, Trade } from '@uniswap/v3-sdk'
import { ethers, providers } from 'ethers'

import { fromTokenAmount, parseSlippageInput } from '@utils/calculations'
import { DEFAULT_SLIPPAGE, OSQUEETH_DECIMALS, UNI_POOL_FEES } from '../constants'
import Web3 from 'web3'

interface getQuoteForETHParams {
  ETHAmount: BigNumber
  slippageAmount?: BigNumber
  pool: Pool
  wethToken: Token
  squeethToken: Token
}

//If I input an exact amount of ETH I want to spend, tells me how much Squeeth I'd purchase
export async function getBuyQuoteForETH({
  ETHAmount,
  slippageAmount = new BigNumber(DEFAULT_SLIPPAGE),
  pool,
  wethToken,
  squeethToken,
}: getQuoteForETHParams) {
  const emptyState = {
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  }

  if (!ETHAmount || !pool || !wethToken || !squeethToken) return emptyState

  try {
    //WETH is input token, squeeth is output token. I'm using WETH to buy Squeeth
    const route = new Route([pool], wethToken, squeethToken)
    //getting the amount of squeeth I'd get out for putting in an exact amount of ETH
    const trade = await Trade.exactIn(
      route,
      CurrencyAmount.fromRawAmount(wethToken, fromTokenAmount(ETHAmount, 18).toString()),
    )

    //the amount of squeeth I'm getting out
    return {
      amountOut: new BigNumber(trade.outputAmount.toSignificant(OSQUEETH_DECIMALS)),
      minimumAmountOut: new BigNumber(
        trade.minimumAmountOut(parseSlippageInput(slippageAmount.toString())).toSignificant(OSQUEETH_DECIMALS),
      ),
      priceImpact: trade.priceImpact.toFixed(2),
    }
  } catch (e) {
    console.log(e)
  }

  return emptyState
}

interface getQuoteParams {
  squeethAmount: BigNumber
  slippageAmount?: BigNumber
  pool: Pool
  wethToken: Token
  squeethToken: Token
}
export async function getBuyQuote({
  squeethAmount,
  slippageAmount = new BigNumber(DEFAULT_SLIPPAGE),
  pool,
  wethToken,
  squeethToken,
}: getQuoteParams) {
  const emptyState = {
    amountIn: new BigNumber(0),
    maximumAmountIn: new BigNumber(0),
    priceImpact: '0',
  }

  if (!squeethAmount || !pool || !wethToken || !squeethToken) return emptyState

  try {
    //WETH is input token, squeeth is output token. I'm using WETH to buy Squeeth
    const route = new Route([pool], wethToken, squeethToken)
    //getting the amount of ETH I need to put in to get an exact amount of squeeth I inputted out
    const trade = await Trade.exactOut(
      route,
      CurrencyAmount.fromRawAmount(squeethToken!, fromTokenAmount(squeethAmount, OSQUEETH_DECIMALS).toString()),
    )

    //the amount of ETH I need to put in
    return {
      amountIn: new BigNumber(trade.inputAmount.toSignificant(18)),
      maximumAmountIn: new BigNumber(
        trade.maximumAmountIn(parseSlippageInput(slippageAmount.toString())).toSignificant(18),
      ),
      priceImpact: trade.priceImpact.toFixed(2),
    }
  } catch (e) {
    console.log(e)
  }

  return emptyState
}

//I input an exact amount of squeeth I want to sell, tells me how much ETH I'd receive
export async function getSellQuote({
  squeethAmount,
  slippageAmount = new BigNumber(DEFAULT_SLIPPAGE),
  pool,
  wethToken,
  squeethToken,
}: getQuoteParams) {
  const emptyState = {
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  }
  if (!squeethAmount || !pool || !wethToken || !squeethToken) return emptyState

  try {
    //squeeth is input token, WETH is output token. I'm selling squeeth for WETH
    const route = new Route([pool], squeethToken, wethToken)
    //getting the amount of ETH I'd receive for inputting the amount of squeeth I want to sell
    const trade = await Trade.exactIn(
      route,
      CurrencyAmount.fromRawAmount(squeethToken!, fromTokenAmount(squeethAmount, OSQUEETH_DECIMALS).toString()),
    )

    //the amount of ETH I'm receiving
    return {
      amountOut: new BigNumber(trade.outputAmount.toSignificant(18)),
      minimumAmountOut: new BigNumber(
        trade.minimumAmountOut(parseSlippageInput(slippageAmount.toString())).toSignificant(18),
      ),
      priceImpact: trade.priceImpact.toFixed(2),
    }
  } catch (e) {
    console.log(e)
  }

  return emptyState
}

//I input an exact amount of ETH I want to receive, tells me how much squeeth I'd need to sell
export async function getSellQuoteForETH({
  ETHAmount,
  slippageAmount = new BigNumber(DEFAULT_SLIPPAGE),
  pool,
  wethToken,
  squeethToken,
}: getQuoteForETHParams) {
  const emptyState = {
    amountIn: new BigNumber(0),
    maximumAmountIn: new BigNumber(0),
    priceImpact: '0',
  }

  if (!ETHAmount || !pool || !wethToken || !squeethToken) return emptyState

  try {
    //squeeth is input token, WETH is output token. I'm selling squeeth for WETH
    const route = new Route([pool], squeethToken, wethToken)
    //getting the amount of squeeth I'd need to sell to receive my desired amount of ETH
    const trade = await Trade.exactOut(
      route,
      CurrencyAmount.fromRawAmount(wethToken!, fromTokenAmount(ETHAmount, 18).toString()),
    )

    //the amount of squeeth I need to sell
    return {
      amountIn: new BigNumber(trade.inputAmount.toSignificant(18)),
      maximumAmountIn: new BigNumber(
        trade.maximumAmountIn(parseSlippageInput(slippageAmount.toString())).toSignificant(18),
      ),
      priceImpact: trade.priceImpact.toFixed(2),
    }
  } catch (e) {
    console.log(e)
  }

  return emptyState
}

interface getBuyParamParams {
  address: string
  amount: BigNumber
  pool: Pool
  wethToken: Token
  squeethToken: Token
}
export async function getBuyParamForETH({ address, amount, pool, wethToken, squeethToken }: getBuyParamParams) {
  if (!pool || !wethToken || !squeethToken) return

  const quote = await getBuyQuoteForETH({ ETHAmount: amount, pool, wethToken, squeethToken })

  return {
    tokenIn: wethToken?.address,
    tokenOut: squeethToken?.address,
    fee: UNI_POOL_FEES,
    recipient: address,
    deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
    amountIn: ethers.utils.parseEther(amount.toString()),
    amountOutMinimum: fromTokenAmount(quote.minimumAmountOut, OSQUEETH_DECIMALS).toString(),
    sqrtPriceLimitX96: 0,
  }
}

export async function getBuyParam({ address, amount, pool, wethToken, squeethToken }: getBuyParamParams) {
  const amountMax = fromTokenAmount(
    (await getBuyQuote({ squeethAmount: amount, pool, wethToken, squeethToken })).maximumAmountIn,
    18,
  )

  return {
    tokenIn: wethToken?.address, // address
    tokenOut: squeethToken?.address, // address
    fee: UNI_POOL_FEES, // uint24
    recipient: address, // address
    deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
    amountOut: fromTokenAmount(amount, OSQUEETH_DECIMALS).toString(), // uint256
    amountInMaximum: amountMax.toString(),
    sqrtPriceLimitX96: 0, // uint160
  }
}

export async function getSellParam({ address, amount, pool, wethToken, squeethToken }: getBuyParamParams) {
  const amountMin = fromTokenAmount(
    (await getSellQuote({ squeethAmount: amount, pool, wethToken, squeethToken })).minimumAmountOut,
    18,
  )

  return {
    tokenIn: squeethToken?.address,
    tokenOut: wethToken?.address,
    fee: UNI_POOL_FEES,
    recipient: address,
    deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
    amountIn: fromTokenAmount(amount, OSQUEETH_DECIMALS).toString(),
    amountOutMinimum: amountMin.toString(),
    sqrtPriceLimitX96: 0,
  }
}
