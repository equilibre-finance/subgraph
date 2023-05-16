/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address, BigInt } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD, UNTRACKED_PAIRS } from './helpers'

const WKAVA_ADDRESS = '0xc86c7c0efbd6a49b35e8714c5f59d99de09a225b'
const WKAVA_USDC_PAIR = '0x5c27a0d0e6d045b5113d728081268642060f7499'

export function getKavaPriceInUSD(): BigDecimal {
  // fetch kava prices for each stablecoin
  let wKavaPair = Pair.load(WKAVA_USDC_PAIR) // wKava is token0

  // all 3 have been created
  if (wKavaPair !== null) {
    return wKavaPair.token1Price
  } else {
    return ZERO_BD
  }
}


// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  '0xc86c7c0efbd6a49b35e8714c5f59d99de09a225b', // WKAVA
  // '0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b', // wBTC
  // '0xe1da44c0da55b075ae8e2e4b6986adc76ac77d73', // VARA
  // '0xdb0e1e86b01c4ad25241b1843e407efc4d615248', // USX
  // '0x765277eebeca2e31912c9946eae1021199b39c61', // DAI
  // '0x9591865d9d4bbd3b5fa8a8e2400fd530d1a16191', // wETH
  // '0x6c2c113c8ca73db67224ef4d8c8dfcec61e52a9c', // LQDR
  // '0xf390830df829cf22c53c8840554b98eafc5dcbc2', // MAI
  // '0x739ca6d71365a08f584c8fc4e1029045fa8abc4b', // ACS
  // '0xc19281f22a075e0f10351cd5d6ea9f0ac63d4327', // BIFI
  '0xfa9343c3897324496a05fc75abed6bac29f8a40f', // USDC
]

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('400000')

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('2')

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findKavaPerToken(token: Token): BigDecimal {
  if (token.id == WKAVA_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]), false)
    if (pairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHexString())
      if (pair.token0 == token.id && pair.reserveKava.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedKava as BigDecimal) // return token1 per our token * Eth per token 1
      }
      if (pair.token1 == token.id && pair.reserveKava.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedKava as BigDecimal) // return token0 per our token * ETH per token 0
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedKava.times(bundle.KavaPrice)
  let price1 = token1.derivedKava.times(bundle.KavaPrice)

  // dont count tracked volume on these pairs - usually rebass tokens
  if (UNTRACKED_PAIRS.includes(pair.id)) {
    return ZERO_BD
  }

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0)
    let reserve1USD = pair.reserve1.times(price1)
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (reserve0USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve1USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString('2'))
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedKava.times(bundle.KavaPrice)
  let price1 = token1.derivedKava.times(bundle.KavaPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
