const axios = require('axios')
const assert = require('assert')

//environmental input
const GuserApiKey = process.env.NEW_RELIC_USER_API_KEY
const GmasterProdAccountId = process.env.NEW_RELIC_PRODMASTER_ACCOUNT_ID
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
async function GetAPMServicesLoop() {
  const METHODNAME='GetAPMServicesLoop'
  var Cursor = {}       //not currently using this
  var aResult = []

  logit(METHODNAME,'maxloops:',GMaxPages)
  for (ii=0; ii < GMaxPages; ii++)
  {
    aTmp = await GetAPMServices(Cursor)
    logit(METHODNAME,'aTmp',aTmp.length,aTmp.length > 0 ? aTmp[0] : 'nada')

    aResult = [...new Set([...aResult,...aTmp])]
    if(Cursor.nextCursor == null) {break}
  }
  logit(METHODNAME,'aResult',aResult.length,aResult.length > 0 ? aResult[0] : 'nada')
  return aResult
}
//
//  note:  asking for cursor but not using it
//
async function GetAPMServices(Cursor) {
  const METHODNAME='GetAPMServices'

  // entitySearch() by APM-Service name
  const cQuery = `{
  actor {
    entitySearch(queryBuilder: {domain: APM}) {
      count
      query
      results {
        entities {
          account {
            id
            name
          }
          entityType
          name
          reporting
          tags {
            key
            values
          }
          domain
          ... on ApmApplicationEntityOutline {
            applicationId
          }
          guid
        }
        nextCursor
      }
    }
  }
}`
const cnextCursor = `{
  actor {
    entitySearch(queryBuilder: {domain: APM}) {
      count
      query
      results(cursor: "NEXTCURSORREPLACEME") {
        entities {
          account {
            id
            name
          }
          entityType
          name
          reporting
          tags {
            key
            values
          }
          domain
          ... on ApmApplicationEntityOutline {
            name
            applicationId
          }
          guid
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
  logit('NerdGraph query', options.method,options.url,Cursor)
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

    var aApps = response.data.data.actor.entitySearch.results.entities
    //debug log
    console.log('first element:',aApps[0])

    var aRes = []
    for (oe of aApps){
      oe[GTargetTag] = 'blank'
      for (ot of oe.tags){
        if(ot.key.toLowerCase() == GTargetTag){
          oe[GTargetTag] = ot.values[0]  //could have multiple ASV values, picking first one
          break
        }
      }
      aRes.push(oe)
    }
    Cursor.nextCursor = response.data.data.actor.entitySearch.results.nextCursor
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
  aApps = await GetAPMServicesLoop()

  aApps.sort((a,b) => {
    if(a.account.id == b.account.id){
      if(a.account.name > b.account.name){return 1} else {return -1}
    }
    if(a.account.id > b.account.id){return 1} else {return -1}
  })

  //dump the resulting list as csv to stdout
  aApps.forEach((val,idx) => {
    slog = [val.account.id,'"'+val.entityType+'"',val.applicationId,'"' + val.name + '"','"' + val.asv + '"']
    console.log(slog.join(','))
  })

  console.log('number of APM Services',aApps.length)

}

main()
