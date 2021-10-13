import { Button, ButtonGroup, createStyles, Fade, makeStyles, Modal, Tab, Tabs } from '@material-ui/core'
import Backdrop from '@material-ui/core/Backdrop'
import React from 'react'
import { useMemo, useState } from 'react'

import { useWallet } from '../../context/wallet'
import { useLongPositions, useShortPositions } from '../../hooks/usePositions'
import { toTokenAmount } from '../../utils/calculations'
import { SecondaryTab, SecondaryTabs } from '../Tabs'
import History from './History'
import Long from './Long'
import Short from './Short'

enum TradeType {
  BUY,
  SELL,
}

type TradeProps = {
  setTradeType: (arg0: TradeType) => void
  tradeType: TradeType
  setAmount: (arg0: number) => void
  amount: number
  setCost: (arg0: number) => void
  cost: number
  setSqueethExposure: (arg0: number) => void
  squeethExposure: number
  showLongTab: boolean
}

const useStyles = makeStyles((theme) =>
  createStyles({
    modal: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    paper: {
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[5],
      padding: theme.spacing(2, 4),
      borderRadius: theme.spacing(1),
      width: '40rem',
      height: '60vh',
    },
  }),
)

const Trade: React.FC<TradeProps> = ({
  setTradeType,
  tradeType,
  setAmount,
  amount,
  setCost,
  cost,
  setSqueethExposure,
  squeethExposure,
  showLongTab,
}) => {
  // const [tradeType, setTradeType] = useState(TradeType.BUY)
  const [modelOpen, setModelOpen] = useState(false)
  const [openPosition, setOpenPosition] = useState(0)
  const classes = useStyles()
  const { balance } = useWallet()
  const { squeethAmount: lngAmt } = useLongPositions()
  const { squeethAmount: shrtAmt } = useShortPositions()

  const showOpenCloseTabs = useMemo(() => {
    return (tradeType === TradeType.BUY && shrtAmt.isZero()) || (tradeType === TradeType.SELL && lngAmt.isZero())
  }, [tradeType, lngAmt.toNumber(), shrtAmt.toNumber()])

  return (
    <div>
      {showOpenCloseTabs ? (
        <SecondaryTabs
          value={openPosition}
          onChange={(evt, val) => setOpenPosition(val)}
          aria-label="simple tabs example"
          centered
          variant="fullWidth"
        >
          <SecondaryTab label="Open" />
          <SecondaryTab label="Close" />
        </SecondaryTabs>
      ) : null}
      <div>
        {tradeType === TradeType.BUY ? (
          shrtAmt.isZero() ? (
            <Long
              amount={amount}
              setAmount={setAmount}
              cost={cost}
              setCost={setCost}
              squeethExposure={squeethExposure}
              setSqueethExposure={setSqueethExposure}
              balance={Number(toTokenAmount(balance, 18).toFixed(4))}
              open={showLongTab || openPosition === 0}
              newVersion={!showLongTab}
              closeTitle="Close squeeth position and redeem ETH"
            />
          ) : (
            <Short
              balance={Number(toTokenAmount(balance, 18).toFixed(4))}
              open={false}
              newVersion={!showLongTab}
              closeTitle="You already have short position, close it to open a long position"
            />
          )
        ) : lngAmt.isZero() ? (
          <Short
            balance={Number(toTokenAmount(balance, 18).toFixed(4))}
            open={showLongTab || openPosition === 0}
            newVersion={!showLongTab}
            closeTitle="Buy back and close position"
          />
        ) : (
          <Long
            amount={amount}
            setAmount={setAmount}
            cost={cost}
            setCost={setCost}
            squeethExposure={squeethExposure}
            setSqueethExposure={setSqueethExposure}
            balance={Number(toTokenAmount(balance, 18).toFixed(4))}
            open={false}
            newVersion={!showLongTab}
            closeTitle="You already have long position, close it to open short position"
          />
        )}
        {/* <Button
          color="primary"
          size="small"
          style={{ marginTop: '4px', background: 'none' }}
          onClick={() => setModelOpen(true)}
        >
          Transaction history
        </Button> */}
        <Modal
          aria-labelledby="enable-notification"
          open={modelOpen}
          className={classes.modal}
          onClose={() => setModelOpen(false)}
          closeAfterTransition
          BackdropComponent={Backdrop}
          BackdropProps={{
            timeout: 500,
          }}
        >
          <Fade in={modelOpen}>
            <div className={classes.paper}>
              <History />
            </div>
          </Fade>
        </Modal>
      </div>
    </div>
  )
}

export default Trade
