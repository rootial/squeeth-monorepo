import BigNumber from 'bignumber.js'
import Notify from 'bnc-notify'
import { useQuery, useQueryClient } from 'react-query'
import Onboard from 'bnc-onboard'
import { API } from 'bnc-onboard/dist/src/interfaces'
import { ethers } from 'ethers'
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Web3 from 'web3'

import { EtherscanPrefix } from '../constants'
import { Networks } from '../types'

const balanceQueryKeys = {
  userWalletBalance: () => ['userWalletBalance'],
}
const useAlchemy = process.env.NEXT_PUBLIC_USE_ALCHEMY
const usePokt = process.env.NEXT_PUBLIC_USE_POKT
const defaultWeb3 = useAlchemy === 'true'
  ? new Web3(`https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`)
  : usePokt === 'true'
  ? new Web3(`https://eth-mainnet.gateway.pokt.network/v1/lb/${process.env.NEXT_PUBLIC_POKT_ID}`)
  : new Web3(`https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`)

type WalletType = {
  web3: Web3
  address: string | null
  networkId: Networks
  signer: any
  selectWallet: () => void
  disconnectWallet: () => void
  connected: boolean
  balance: BigNumber
  handleTransaction: any
}

const initialState: WalletType = {
  web3: defaultWeb3,
  address: null,
  networkId: Networks.MAINNET,
  signer: null,
  selectWallet: () => null,
  disconnectWallet: () => null,
  connected: false,
  balance: new BigNumber(0),
  handleTransaction: () => null,
}

const walletContext = React.createContext<WalletType>(initialState)
const useWallet = () => useContext(walletContext)

const WalletProvider: React.FC = ({ children }) => {
  const [web3, setWeb3] = useState<Web3>(defaultWeb3)
  const [address, setAddress] = useState<string | null>(null)
  const [networkId, setNetworkId] = useState(Networks.MAINNET)
  const [onboard, setOnboard] = useState<API | null>(null)
  const [notify, setNotify] = useState<any>(null)
  const [signer, setSigner] = useState<any>(null)

  const queryClient = useQueryClient()

  const balanceQuery = useQuery(balanceQueryKeys.userWalletBalance(), () => getBalance(web3, address), {
    enabled: Boolean(address),
    refetchInterval: 30000,
  })

  const onWalletSelect = useCallback(async () => {
    if (!onboard) return
    onboard.walletSelect().then((success) => {
      if (success) onboard.walletCheck()
    })
  }, [onboard])

  const disconnectWallet = useCallback(async () => {
    if (!onboard) return
    await onboard.walletReset()
    queryClient.removeQueries()
    setAddress(null)
    queryClient.setQueryData(balanceQueryKeys.userWalletBalance(), new BigNumber(0))
  }, [onboard])

  const setAddr = (address: string) => setAddress(address.toLowerCase())

  function addEtherscan(transaction: any) {
    if (networkId === Networks.LOCAL) return
    return {
      link: `${EtherscanPrefix[networkId]}${transaction.hash}`,
    }
  }

  const handleTransaction = (tx: any) => {
    if (!notify) return
    tx.on('transactionHash', (hash: string) => {
      const { emitter } = notify.hash(hash)
      //have to return the emitter object in last order, or the latter emitter object will replace the previous one
      //if call getbalance in second order, since it has no return, it will show default notification w/o etherscan link
      emitter.on('all', getBalance)
      emitter.on('all', addEtherscan)
    })

    return tx
  }

  const store: WalletType = useMemo(
    () => ({
      web3,
      address,
      networkId,
      signer,
      connected: !!address && networkId in Networks,
      balance: balanceQuery.data ?? new BigNumber(0),
      selectWallet: onWalletSelect,
      disconnectWallet: disconnectWallet,
      handleTransaction,
    }),
    [web3, address, networkId, signer, balanceQuery.data?.toString(), onWalletSelect, disconnectWallet],
  )

  useEffect(() => {
    const onNetworkChange = (updateNetwork: number) => {
      if (updateNetwork in Networks) {
        setNetworkId(updateNetwork)
        if (onboard !== null) {
          const network = updateNetwork === 1337 ? 31337 : updateNetwork
          localStorage.setItem('networkId', network.toString())
          onboard.config({
            networkId: network,
          })
        }
      } else {
        if (address === null) return
        onboard.walletCheck()
        console.log('Unsupported network')
      }
    }

    const onWalletUpdate = (wallet: any) => {
      if (wallet.provider) {
        window.localStorage.setItem('selectedWallet', wallet.name)
        const provider = new ethers.providers.Web3Provider(wallet.provider)
        provider.pollingInterval = 30000
        setWeb3(new Web3(wallet.provider))
        setSigner(() => provider.getSigner())
      }
    }

    const network = networkId === 1 ? 'mainnet' : 'ropsten'
    const RPC_URL =
      networkId === Networks.LOCAL
        ? 'http://127.0.0.1:8545/'
        : networkId === Networks.ARBITRUM_RINKEBY
        ? 'https://rinkeby.arbitrum.io/rpc'
        : useAlchemy === 'true'
        ? `https://eth-${network}.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        : usePokt === 'true'
        ? `https://eth-${network}.gateway.pokt.network/v1/lb/${process.env.NEXT_PUBLIC_POKT_ID}`
        : `https://${network}.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`

    const onboard = Onboard({
      dappId: process.env.NEXT_PUBLIC_BLOCKNATIVE_DAPP_ID,
      networkId: networkId,
      darkMode: true,
      blockPollingInterval: 30000,
      subscriptions: {
        address: setAddr,
        network: onNetworkChange,
        wallet: onWalletUpdate,
        // balance: (balance) => setBalance(new BigNumber(balance)),
      },
      walletSelect: {
        description: `<div>
          <p> By connecting a wallet, you agree to the Opyn user <a href="/terms-of-service" style="color: #2CE6F9;" target="_blank">Terms of Service</a> and acknowledge that you have read and understand the Opyn <a href="/privacy-policy" style="color: #2CE6F9;" target="_blank">Privacy Policy</a>.</p>
          </div > `,

        wallets: [
          { walletName: 'metamask', preferred: true },
          { walletName: 'coinbase', preferred: false },
          {
            walletName: 'walletLink',
            rpcUrl: RPC_URL,
          },
          {
            walletName: 'walletConnect',
            preferred: true,
            rpc: {
              [networkId]: RPC_URL,
            },
          },
          {
            walletName: 'lattice',
            rpcUrl: RPC_URL,
            preferred: true,
            appName: 'Opyn V2',
          },
          {
            walletName: 'ledger',
            preferred: true,
            rpcUrl: RPC_URL,
          },
          {
            walletName: 'gnosis',
            appName: 'WalletConnect',
          },
        ],
      },
      // walletCheck: [networkCheckResult],
      walletCheck: [
        { checkName: 'derivationPath' },
        { checkName: 'connect' },
        { checkName: 'accounts' },
        { checkName: 'network' },
      ],
    })

    const notify = Notify({
      dappId: process.env.NEXT_PUBLIC_BLOCKNATIVE_DAPP_ID, // [String] The API key created by step one above
      networkId: networkId, // [Integer] The Ethereum network ID your Dapp uses.
      darkMode: true, // (default: false)
    })

    setOnboard(onboard)
    setNotify(notify)

    // removed it for whitelist checking
    const previouslySelectedWallet = window.localStorage.getItem('selectedWallet')

    if (previouslySelectedWallet && onboard) {
      onboard.walletSelect(previouslySelectedWallet).then((success) => {
        console.log('Connected to wallet', success)
      })
    }
  }, [networkId])

  return <walletContext.Provider value={store}>{children}</walletContext.Provider>
}

async function getBalance(web3: Web3, address: string | null) {
  try {
    if (!address) return
    const balance = await web3.eth.getBalance(address)
    return new BigNumber(balance)
  } catch {
    return new BigNumber(0)
  }
}

export { useWallet, WalletProvider }
