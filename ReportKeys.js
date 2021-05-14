const axios = require('axios')
const assert = require('assert')

//environmental input
const GuserApiKey = process.env.NEW_RELIC_USER_API_KEY
const GTargetTag = 'asv'
const GMaxPages = 10000
//
//
//
async function GetAppNameList() {

  // nrql query from license data to get all accounts/apps for 6.1.0
  const cQuery = `{
  actor {
    account(id: MASTERPRODACCT) {
      nrql(query: "SELECT count(*) as 'ncnt' FROM NrDailyUsage WHERE apmLanguage='java' and apmAgentVersion = '6.1.0' facet consumingAccountName, apmAppName since 1 day ago limit 2000") {
        nrql
        otherResult
        totalResult
        results
      }
    }
  }
}`

  oData = {query:cQuery.replace('MASTERPRODACCT',GmasterProdAccountId),variables:""}
  console.log('payload:',oData)
  sURI = 'https://api.newrelic.com/graphql'
  var options = {
    method: 'post',
    url: sURI,
    data: oData,
    headers: {'Api-Key': GuserApiKey}
  }

  console.log('GetAppNameList()-> Nerdgraphing')
  try {
    response = await axios(options)
		if (response.status != 200) {
      console.log('GetAppNameList()-> failed:',response.status)
      throw ('axios dead')
    }
    if (response.data.errors){
      console.log('graphql errors:',response.data.errors)
      throw ('GetAppNameList()->graphql errors')
    }
    var rApps = []
    var aApps = response.data.data.actor.account.nrql.results
    for (oe of aApps){
      rApps.push({consumingAccountName:oe.facet[0],appName:oe.facet[1]})
    }
    console.log('GetAppNameList()->rApps:',rApps.length,rApps.length > 0 ? rApps[0] : 'nada')
    return rApps
  } catch (e) {
    console.log('GetAppNameList()->caught exception:',e)
    throw e
  }
}
//
//
//
async function GetEntitiesLoop() {
  const METHODNAME='GetEntitiesLoop'
  var Cursor = {}       //not currently using this
  var aResult = []

  logit(METHODNAME,'maxloops:',GMaxPages)
  for (ii=0; ii < GMaxPages; ii++)
  {
    aTmp = await GetEntities(Cursor)
    logit(METHODNAME,'aTmp',ii,aTmp.length,aTmp.length > 0 ? aTmp[0] : 'nada')

    aResult = [...new Set([...aResult,...aTmp])]
    if(Cursor.nextCursor == null) {break}
  }
  logit(METHODNAME,'aResult',aResult.length,aResult.length > 0 ? aResult[0] : 'nada')
  return aResult
}
//
//  note:  asking for cursor but not using it
//
async function GetEntities(Cursor) {
  const METHODNAME='GetEntities'

  // entitySearch() by APM-Service name
  const cQuery = `{
    actor {
      apiAccess {
        keySearch(query: {types: INGEST, scope: {ingestTypes: LICENSE}}) {
          keys {
            id
            key
            name
            ... on ApiAccessIngestKey {
              id
              name
              accountId
              type
            }
            type
          }
          nextCursor
        }
      }
    }
  }`
const cnextCursor = `{
  actor {
    apiAccess {
      keySearch(query: {types: INGEST, scope: {ingestTypes: LICENSE}}, cursor: "NEXTCURSORREPLACEME") {
        keys {
          id
          key
          name
          ... on ApiAccessIngestKey {
            id
            name
            accountId
            type
          }
          type
        }
        nextCursor
      }
    }
  }
}`

  //push the csv into the entitySearch() query
  oData = {}
  if (Cursor.nextCursor == null){
    oData = {query:cQuery,variables:""}
  } else {
    oData = {query:cnextCursor.replace('NEXTCURSORREPLACEME',Cursor.nextCursor),variables:""}
  }
  //console.log('payload:',oData)
  sURI = 'https://api.newrelic.com/graphql'
  var options = {
    method: 'post',
    url: sURI,
    data: oData,
    headers: {'Api-Key': GuserApiKey}
  }
  logit(METHODNAME,'NerdGraph query', options.method,options.url,Cursor)
  try {
    response = await axios(options)
		if (response.status != 200) {
      logit(METHODNAME,'axiox failed:',response.status)
      throw ('axios dead')
    }
    if (response.data.errors){
      logit(METHODNAME,'graphql errors:',response.data.errors)
      throw ('graphql errors')
    }

    //debug print
    //console.log('debug dump',response.data.data.actor)

    var aApps = response.data.data.actor.apiAccess.keySearch.keys
    //debug log
    console.log('first element:',aApps[0])

    var aRes = aApps

    Cursor.nextCursor = response.data.data.actor.apiAccess.keySearch.nextCursor
    logit(METHODNAME,'results are',Cursor,aRes.length > 0 ? aRes[0] : 'nada')
    return aRes
  } catch (e) {
    logit(METHODNAME,'caught exception:',e)
    throw e
  }
}
//stdout logger
function logit(mname,msg, ...theargs){
  if(mname == null || msg == null){throw('logit(method,msg,...) requires at least 2 params')}
  console.log(`[${(new Date()).toISOString()}]${mname}()-> ${msg}${theargs.length == 0 ? '' : ':'}`,...theargs)
}
//
//
//
async function main() {
  var qCursor

  //retrieve all APM Services
  aApps = await GetEntitiesLoop()

  aApps.sort((a,b) => {
    if(a.accountId == b.accountId){
      if(a.name > b.name){return 1} else {return -1}
    }
    if(a.accounId > b.accountId){return 1} else {return -1}
  })

  //dump the resulting list as csv to stdout
  aApps.forEach((val,idx) => {
    slog = [val.accountId,val.name,'"' + val.key + '"']
    console.log(slog.join(','))
  })

  console.log('number of Keys',aApps.length)

}

main()
