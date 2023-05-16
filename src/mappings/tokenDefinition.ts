import {
  Address,
  BigInt,
} from "@graphprotocol/graph-ts"

// Initialize a Token Definition with the attributes
export class TokenDefinition {
  address: Address
  symbol: string
  name: string
  decimals: BigInt

  // Initialize a Token Definition with its attributes
  constructor(address: Address, symbol: string, name: string, decimals: BigInt) {
    this.address = address
    this.symbol = symbol
    this.name = name
    this.decimals = decimals
  }

  // Get all tokens with a static defintion
  static getStaticDefinitions(): Array<TokenDefinition> {
    let staticDefinitions = new Array<TokenDefinition>()

    // Add USDC
    staticDefinitions.push(
      new TokenDefinition(
        Address.fromString('0xfa9343c3897324496a05fc75abed6bac29f8a40f'),
        'USDC',
        'USDCoin',
        BigInt.fromI32(6)
      )
    )

    staticDefinitions.push(
      new TokenDefinition(
        Address.fromString('0xc86c7c0efbd6a49b35e8714c5f59d99de09a225b'),
        'WKAVA',
        'Wrapped Kava',
        BigInt.fromI32(18)
      )
    )

    staticDefinitions.push(
      new TokenDefinition(
        Address.fromString('0x332730a4f6e03d9c55829435f10360e13cfa41ff'),
        'BUSD',
        'BUSD',
        BigInt.fromI32(18)
      )
    )

    staticDefinitions.push(
      new TokenDefinition(
        Address.fromString('0xe1da44c0da55b075ae8e2e4b6986adc76ac77d73'),
        'VARA',
        'Vara',
        BigInt.fromI32(18)
      )
    )

    staticDefinitions.push(
      new TokenDefinition(
        Address.fromString('0xb44a9b6905af7c801311e8f4e76932ee959c663c'),
        'USDT',
        'USDT',
        BigInt.fromI32(6)
      )
    )

    staticDefinitions.push(
      new TokenDefinition(
        Address.fromString('0xc13791da84f43525189456cfe2026c60d3b7f706'),
        'WETH',
        'Wrapped ETH',
        BigInt.fromI32(18) // done 
      )
    )
    

    staticDefinitions.push(
      new TokenDefinition(
        Address.fromString('0x765277eebeca2e31912c9946eae1021199b39c61'),
        'DAI',
        'DAI',
        BigInt.fromI32(18) // almost 
      )
    )

    return staticDefinitions
  }

  // Helper for hardcoded tokens
  static fromAddress(tokenAddress: Address): TokenDefinition | null {
    let staticDefinitions = this.getStaticDefinitions()
    let tokenAddressHex = tokenAddress.toHexString()

    // Search the definition using the address
    for (let i = 0; i < staticDefinitions.length; i++) {
      let staticDefinition = staticDefinitions[i]
      if (staticDefinition.address.toHexString() == tokenAddressHex) {
        return staticDefinition
      }
    }

    // If not found, return null
    return null
  }

}