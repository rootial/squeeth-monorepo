import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import erc20Abi from '../abis/erc20.json'
import { useWallet } from '../context/wallet'
import useInterval from './useInterval'

/**
 * get token balance.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {BigNumber} raw balance
 */
export const useTokenBalance = (token: string, refetchIntervalSec = 20): BigNumber => {
  const [balance, setBalance] = useState(new BigNumber(0))
  const [contract, setContract] = useState<Contract>()

  const { address, web3 } = useWallet()

  useEffect(() => {
    if (!web3) return
    setContract(new web3.eth.Contract(erc20Abi as any, token))
  }, [web3, token])

  useEffect(() => {
    updateBalance()
  }, [address, token, contract])

  const getBalance = useCallback(async () => {
    if (!contract || !address) return balance

    const _bal = await contract.methods.balanceOf(address).call({
      from: address,
    })
    return new BigNumber(_bal.toString())
  }, [contract, address])

  const updateBalance = useCallback(async () => {
    if (!token) return
    if (!address) return
    const balance = await getBalance()
    setBalance(balance)
  }, [address, token, getBalance])

  useInterval(updateBalance, refetchIntervalSec * 1000)

  return balance
}
