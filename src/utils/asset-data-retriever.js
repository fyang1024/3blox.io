const async = require('async')
const axios = require('axios')
const fs = require('fs');
const assetDataUtils = require('@0x/order-utils').assetDataUtils
const AssetProxyId = require('@0x/types').AssetProxyId
const relayers = require('../relayers.json')

const WETH_ADDRESS_SUFFIX = '2aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

function requestAssetPairs(endPoint) {
  return axios.get(endPoint + (endPoint.endsWith('/') ? '' : '/') + 'asset_pairs?page=1&perPage=1000')
}

function getAssets(relayers) {
  let assets = {}
  async.eachOfSeries(relayers, function (relayer, key, next) {
      console.log(relayer)
      requestAssetPairs(relayer.sra_http_endpoint).then((response) => {
        if (response.data && response.data.records) {
          console.log(relayer.sra_http_endpoint)
          response.data.records.forEach((record) => {
            if (record.assetDataA.assetData.toLowerCase().endsWith(WETH_ADDRESS_SUFFIX)) {
              if (!assets[record.assetDataB.assetData]) {
                assets[record.assetDataB.assetData] = record.assetDataB
              }
              if (!assets[record.assetDataB.assetData].relayers) {
                assets[record.assetDataB.assetData].relayers = []
              }
              assets[record.assetDataB.assetData].relayers.push(relayer.sra_http_endpoint)
            } else if (record.assetDataB.assetData.toLowerCase().endsWith(WETH_ADDRESS_SUFFIX)) {
              if (!assets[record.assetDataA.assetData]) {
                assets[record.assetDataA.assetData] = record.assetDataA
              }
              if (!assets[record.assetDataA.assetData].relayers) {
                assets[record.assetDataA.assetData].relayers = []
              }
              assets[record.assetDataA.assetData].relayers.push(relayer.sra_http_endpoint)
            }
          })
        }
        next()
      })
    },
    function () {
      async.eachOfSeries(assets, function (value, key, next) {
        let tokenAddress
        if (key.startsWith(AssetProxyId.ERC20)) {
          tokenAddress = assetDataUtils.decodeERC20AssetData(key).tokenAddress
        } else if (key.startsWith(AssetProxyId.ERC721)) {
          tokenAddress = assetDataUtils.decodeERC721AssetData(key).tokenAddress
        }
        if (tokenAddress) {
          axios.get(`http://api.ethplorer.io/getTokenInfo/${tokenAddress}?apiKey=freekey`).then((response) => {
            console.log(response.data)
            if (response.data.symbol) {
              assets[key].symbol = response.data.symbol
            }
            if (response.data.name) {
              assets[key].name = response.data.name
            }
            if (response.data.address) {
              assets[key].address = response.data.address
            }
            setTimeout(next, 2000)
          })
        } else {
          next()
        }
      }, function () {
        const a = []
        for (let key in assets) {
          if(assets[key].symbol) a.push(assets[key])
        }
        a.sort(function(assetA, assetB) { return assetA.symbol - assetB.symbol})
        fs.writeFile('src/assets.json', JSON.stringify(a), function(err) {
          if (err) console.log(err)
          else console.log('Done!')
        })
      })
    }
  )
}

getAssets(relayers)