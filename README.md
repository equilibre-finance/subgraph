# Equilibre Subgraph

### Endpoints

- http://127.0.0.1:8000/subgraphs/name/equilibre/subgraph2/graphql
- Queries (HTTP):     http://127.0.0.1:8000/subgraphs/name/equilibre/subgraph2
- Subscriptions (WS): http://127.0.0.1:8001/subgraphs/name/equilibre/subgraph2


### Querying Aggregated Data

```graphql
{
  uniswapFactories(first: 1) {
    pairCount
    totalVolumeUSD
    totalLiquidityUSD
  }
}
```
