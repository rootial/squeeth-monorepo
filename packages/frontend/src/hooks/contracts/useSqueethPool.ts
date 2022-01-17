import { CurrencyAmount, Percent, Token } from '@uniswap/sdk-core'
import { NonfungiblePositionManager, Pool, Position, Route, Tick, Trade } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import { ethers, providers } from 'ethers'
import { useEffect, useState, useCallback } from 'react'
import { Contract } from 'web3-eth-contract'

import quoterABI from '../../abis/quoter.json'
import routerABI from '../../abis/swapRouter.json'
import uniABI from '../../abis/uniswapPool.json'
import erc20Abi from '../../abis/erc20.json'

import { INDEX_SCALE, UNI_POOL_FEES, DEFAULT_SLIPPAGE, OSQUEETH_DECIMALS } from '../../constants'
import { useWallet } from '@context/wallet'
import { fromTokenAmount, parseSlippageInput, toTokenAmount } from '@utils/calculations'
import { useAddresses } from '../useAddress'
import { Networks } from '../../types'
import useUniswapTicks from '../useUniswapTicks'
import { useTrade } from '@context/trade'
import { getBuyQuoteForETH, getBuyParam, getBuyParamForETH, getSellParam, getSellQuote } from '../../lib/squeethPool'
// import univ3prices from '@thanpolas/univ3prices'
// const univ3prices = require('@thanpolas/univ3prices')

const NETWORK_QUOTE_GAS_OVERRIDE: { [chainId: number]: number } = {
  [Networks.ARBITRUM_RINKEBY]: 6_000_000,
}
const DEFAULT_GAS_QUOTE = 2_000_000

/**
 * Hook to interact with WETH contract
 */
export const useSqueethPool = () => {
  const [squeethContract, setSqueethContract] = useState<Contract>()
  const [swapRouterContract, setSwapRouterContract] = useState<Contract>()
  // const [quoterContract, setQuoterContract] = useState<Contract>()
  const [pool, setPool] = useState<Pool>()
  const [wethToken, setWethToken] = useState<Token>()
  const [squeethToken, setSqueethToken] = useState<Token>()
  const [squeethInitialPrice, setSqueethInitialPrice] = useState<BigNumber>(new BigNumber(0))
  const [squeethPrice, setSqueethPrice] = useState<BigNumber>(new BigNumber(0))
  const [wethPrice, setWethPrice] = useState<BigNumber>(new BigNumber(0))
  const [ready, setReady] = useState(false)
  const { ethPrice } = useTrade()

  const { address, web3, networkId, handleTransaction } = useWallet()
  const { squeethPool, swapRouter, quoter, weth, oSqueeth } = useAddresses()
  const { ticks } = useUniswapTicks()

  useEffect(() => {
    if (!web3 || !squeethPool || !swapRouter) return
    setSqueethContract(new web3.eth.Contract(uniABI as any, squeethPool))
    setSwapRouterContract(new web3.eth.Contract(routerABI as any, swapRouter))
    // setQuoterContract(new web3.eth.Contract(quoterABI as any, quoter))
  }, [web3])

  const isWethToken0 = parseInt(weth, 16) < parseInt(oSqueeth, 16)

  useEffect(() => {
    if (!squeethToken?.address || !pool || !wethToken) return
    ;(async function () {
      const buyQuoteForOneETH = await getBuyQuoteForETH({
        ETHAmount: new BigNumber(1),
        pool,
        wethToken,
        squeethToken,
      })
      setSqueethPrice(buyQuoteForOneETH.amountOut)
      setSqueethInitialPrice(
        new BigNumber(
          !isWethToken0 ? pool?.token0Price.toSignificant(18) || 0 : pool?.token1Price.toSignificant(18) || 0,
        ),
      )
      setReady(true)
      setWethPrice(
        toTokenAmount(
          new BigNumber(
            isWethToken0 ? pool?.token1Price.toSignificant(18) || 0 : pool?.token0Price.toSignificant(18) || 0,
          ),
          18,
        ),
      )

      return
    })()
  }, [isWethToken0, pool?.token1Price.toFixed(18), squeethToken?.address, wethToken?.address])

  useEffect(() => {
    ;(async function updateData() {
      if (!squeethContract || !ticks) return

      const { token0, token1, fee } = await getImmutables()
      const isWethToken0 = parseInt(weth, 16) < parseInt(oSqueeth, 16)

      const state = await getPoolState()
      const TokenA = new Token(
        networkId,
        token0,
        isWethToken0 ? 18 : OSQUEETH_DECIMALS,
        isWethToken0 ? 'WETH' : 'SQE',
        isWethToken0 ? 'Wrapped Ether' : 'oSqueeth',
      )
      const TokenB = new Token(
        networkId,
        token1,
        isWethToken0 ? OSQUEETH_DECIMALS : 18,
        isWethToken0 ? 'SQE' : 'WETH',
        isWethToken0 ? 'oSqueeth' : 'Wrapped Ether',
      )

      const pool = new Pool(
        TokenA,
        TokenB,
        Number(fee),
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        Number(state.tick),
        ticks || [],
      )
      //const setBeginningPrice =  pool.token0Price

      setPool(pool)
      setWethToken(isWethToken0 ? TokenA : TokenB)
      setSqueethToken(isWethToken0 ? TokenB : TokenA)
    })()
  }, [oSqueeth, squeethContract, ticks?.length, weth])
  // squeethContract, ticks?.length

  const getImmutables = async () => {
    return {
      token0: await squeethContract?.methods.token0().call(),
      token1: await squeethContract?.methods.token1().call(),
      fee: await squeethContract?.methods.fee().call(),
      tickSpacing: await squeethContract?.methods.tickSpacing().call(),
      maxLiquidityPerTick: await squeethContract?.methods.maxLiquidityPerTick().call(),
    }
  }

  function getWSqueethPositionValue(amount: BigNumber | number) {
    return new BigNumber(amount).times(squeethInitialPrice).times(ethPrice)
  }

  function getWSqueethPositionValueInETH(amount: BigNumber | number) {
    return new BigNumber(amount).times(squeethInitialPrice)
  }

  async function getPoolState() {
    const slot = await squeethContract?.methods.slot0().call()
    const PoolState = {
      liquidity: await squeethContract?.methods.liquidity().call(),
      sqrtPriceX96: slot[0],
      tick: slot[1],
      observationIndex: slot[2],
      observationCardinality: slot[3],
      observationCardinalityNext: slot[4],
      feeProtocol: slot[5],
      unlocked: slot[6],
    }

    return PoolState
  }

  const buy = async (amount: BigNumber) => {
    if (!pool || !wethToken || !squeethToken || !address) return
    const exactOutputParam = await getBuyParam({ address, amount, pool, wethToken, squeethToken })

    await handleTransaction(
      swapRouterContract?.methods.exactOutputSingle(exactOutputParam).send({
        from: address,
      }),
    )
  }

  const buyForWETH = async (amount: BigNumber) => {
    if (!pool || !wethToken || !squeethToken || !address) return
    const exactInputParam = await getBuyParamForETH({
      amount: new BigNumber(amount),
      address,
      pool,
      wethToken,
      squeethToken,
    })

    const txHash = await handleTransaction(
      swapRouterContract?.methods.exactInputSingle(exactInputParam).send({
        from: address,
        value: ethers.utils.parseEther(amount.toString()),
      }),
    )

    return txHash
  }

  const buyAndRefund = async (amount: BigNumber) => {
    const callData = await buyAndRefundData(amount)

    const txHash = await handleTransaction(
      swapRouterContract?.methods.multicall(callData).send({
        from: address,
        value: ethers.utils.parseEther(amount.toString()),
      }),
    )

    return txHash
  }

  const buyAndRefundData = async (amount: BigNumber) => {
    if (!web3 || !pool || !wethToken || !squeethToken || !address) return
    const exactInputParam = await getBuyParamForETH({ address, amount, pool, wethToken, squeethToken })

    if (exactInputParam) {
      exactInputParam.recipient = address
      const tupleInput = Object.values(exactInputParam).map((v) => v?.toString() || '')

      const swapIface = new ethers.utils.Interface(routerABI)
      const encodedSwapCall = swapIface.encodeFunctionData('exactInputSingle', [tupleInput])
      const encodedRefundCall = swapIface.encodeFunctionData('refundETH')

      return [encodedSwapCall, encodedRefundCall]
    }
  }

  const sell = async (amount: BigNumber) => {
    const callData = await sellAndUnwrapData(amount)

    const txHash = await handleTransaction(
      swapRouterContract?.methods.multicall(callData).send({
        from: address,
      }),
    )

    return txHash
  }

  const sellAndUnwrapData = async (amount: BigNumber) => {
    if (!web3 || !pool || !wethToken || !squeethToken || !address) return
    const exactInputParam = await getSellParam({ address, amount, pool, wethToken, squeethToken })
    exactInputParam.recipient = swapRouter
    const tupleInput = Object.values(exactInputParam).map((v) => v?.toString() || '')

    const { minimumAmountOut } = await getSellQuote({ squeethAmount: amount, pool, wethToken, squeethToken })
    const swapIface = new ethers.utils.Interface(routerABI)
    const encodedSwapCall = swapIface.encodeFunctionData('exactInputSingle', [tupleInput])
    const encodedUnwrapCall = swapIface.encodeFunctionData('unwrapWETH9', [
      fromTokenAmount(minimumAmountOut, 18).toString(),
      address,
    ])
    return [encodedSwapCall, encodedUnwrapCall]
  }

  //If I input an exact amount of squeeth I want to buy, tells me how much ETH I need to pay to purchase that squeeth
  const getBuyQuote = async (squeethAmount: BigNumber, slippageAmount = new BigNumber(DEFAULT_SLIPPAGE)) => {
    const emptyState = {
      amountIn: new BigNumber(0),
      maximumAmountIn: new BigNumber(0),
      priceImpact: '0',
    }

    if (!squeethAmount || !pool) return emptyState

    try {
      //WETH is input token, squeeth is output token. I'm using WETH to buy Squeeth
      const route = new Route([pool], wethToken!, squeethToken!)
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

  return {
    pool,
    squeethToken,
    wethToken,
    squeethInitialPrice,
    squeethPrice,
    wethPrice,
    ready,
    isWethToken0,
    buy,
    sell,
    buyForWETH,
    buyAndRefund,
    getBuyQuote,
    getWSqueethPositionValue,
    getWSqueethPositionValueInETH,
  }
}
