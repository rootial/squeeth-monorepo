import '../styles/globals.css'

import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import { AppProps } from 'next/app'
import Head from 'next/head'
import React from 'react'

import { WalletProvider } from '../src/context/wallet'
import { WorldProvider } from '../src/context/world'
import getTheme, { Mode } from '../src/theme'

export default function MyApp(props: AppProps) {
  const { Component, pageProps } = props

  React.useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector('#jss-server-side')
    if (jssStyles) {
      jssStyles.parentElement!.removeChild(jssStyles)
    }
  }, [])

  return (
    <React.Fragment>
      <Head>
        <title>Squeeth</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
      </Head>
      <WalletProvider>
        <ThemeProvider theme={getTheme(Mode.DARK)}>
          {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
          <CssBaseline />
          <WorldProvider>
            <Component {...pageProps} />
          </WorldProvider>
        </ThemeProvider>
      </WalletProvider>
    </React.Fragment>
  )
}
