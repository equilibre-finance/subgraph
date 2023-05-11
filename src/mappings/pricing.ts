/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address, BigInt } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD, UNTRACKED_PAIRS } from './helpers'

const WKAVA_ADDRESS = '0xc86c7c0efbd6a49b35e8714c5f59d99de09a225b' // sk was 0x4200000000000000000000000000000000000006 in optimism
const USDC_WKAVA_PAIR = '0x5C27a0D0e6d045b5113D728081268642060f7499' // sk // created 10008355
// const DAI_WETH_PAIR = '0x534f3135757db41c4f705b0eac697659f68c4014' // created block 10042267
// const USDT_WETH_PAIR = '0xc875b07b96b53b80557354a170edd483d24c3ba0' // created block 10093341

export function getKavaPriceInUSD(): BigDecimal {
  // fetch kava prices for each stablecoin
  // let daiPair = Pair.load(DAI_WETH_PAIR) // dai is token0
  let usdcPair = Pair.load(USDC_WKAVA_PAIR) // usdc is token0
  // let usdtPair = Pair.load(USDT_WETH_PAIR) // usdt is token1

  if (usdcPair != null){
    return usdcPair.token1Price
  }

  return ZERO_BD;

  // // all 3 have been created
  // if (daiPair !== null && usdcPair !== null && usdtPair !== null) {
  //   let totalLiquidityETH = daiPair.reserve0.plus(usdcPair.reserve0).plus(ZERO_BD)
  //   let daiWeight = daiPair.reserve0.div(totalLiquidityETH)
  //   let usdcWeight = usdcPair.reserve0.div(totalLiquidityETH)
  //   let usdtWeight = ZERO_BD//usdtPair.reserve0.div(totalLiquidityETH)
  //   return daiPair.token0Price
  //     .times(daiWeight)
  //     .plus(usdcPair.token0Price.times(usdcWeight))
  //     .plus(usdtPair.token1Price.times(usdtWeight))
  //   // dai and USDC have been created
  // } else if (daiPair !== null && usdcPair !== null) {
  //   let totalLiquidityETH = daiPair.reserve0.plus(usdcPair.reserve0)
  //   let daiWeight = daiPair.reserve0.div(totalLiquidityETH)
  //   let usdcWeight = usdcPair.reserve0.div(totalLiquidityETH)
  //   return daiPair.token1Price.times(daiWeight).plus(usdcPair.token1Price.times(usdcWeight))
  //   // USDC is the only pair so far
  // } else if (usdcPair !== null) {
  //   return usdcPair.token1Price
  // } else {
  //   return ZERO_BD
  // }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  '0xc86c7c0efbd6a49b35e8714c5f59d99de09a225b', // WKAVA
  // '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
  '0xfa9343c3897324496a05fc75abed6bac29f8a40f', // USDC
  // '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT
  // '0x4200000000000000000000000000000000000042', // OP
  // '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f', //SNX
  // '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' // WBTC
]

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('400000')

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_KAVA = BigDecimal.fromString('2')

/**
 * Search through graph to find derived Kava per token.
 * @todo update to be derived KAVA (add stablecoin estimates)
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
      if (pair.token0 == token.id && pair.reserveKAVA.gt(MINIMUM_LIQUIDITY_THRESHOLD_KAVA)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedKAVA as BigDecimal) // return token1 per our token * Kava per token 1
      }
      if (pair.token1 == token.id && pair.reserveKAVA.gt(MINIMUM_LIQUIDITY_THRESHOLD_KAVA)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedKAVA as BigDecimal) // return token0 per our token * KAVA per token 0
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
  let price0 = token0.derivedKAVA.times(bundle.kavaPrice)
  let price1 = token1.derivedKAVA.times(bundle.kavaPrice)

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
  let price0 = token0.derivedKAVA.times(bundle.kavaPrice)
  let price1 = token1.derivedKAVA.times(bundle.kavaPrice)

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
