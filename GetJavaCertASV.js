const axios = require('axios')
const assert = require('assert')

//environmental input
const GuserApiKey = process.env.NEW_RELIC_USER_API_KEY
const GmasterProdAccountId = process.env.NEW_RELIC_PRODMASTER_ACCOUNT_ID
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
async function QueryAppNameLoop(aAppObjs) {

  const batchsize = 200
  var sCursor = null       //not currently using this
  var aResult = []

  console.log('QueryAppNameLoop()->AppObj length, batchsize:',aAppObjs.length, batchsize)
  for (ii=0; ii*batchsize < aAppObjs.length; ii++)
  {
    scsv=''
    console.log('QueryAppNameLoop()->ii batch base:',ii)
    for (i=0; i < batchsize && i+ii*batchsize < aAppObjs.length; i++){
      scsv = scsv.concat(",'" + aAppObjs[i+ii*batchsize].appName + "'")
    }
    if(scsv > ''){
      scsv = scsv.substring(1)
    }
    console.log('QueryAppNameLoop()-> scsv(64):',scsv.substring(0,64))
    aTmp = await QueryAppNameList(scsv,sCursor)
    console.log('aTmp',aTmp.length,aTmp.length > 0 ? aTmp[0] : 'nada')

    aResult = [...new Set([...aResult,...aTmp])]
  }
  console.log('QueryAppNameLoop()->aResult',aResult.length,aResult.length > 0 ? aResult[0] : 'nada')
  return aResult
}


//
//  note:  asking for cursor but not using it
//
async function QueryAppNameList(csvAppNames, sCursor) {

  // entitySearch() by APM-Service name
  const cQuery = `{
      actor {
        entitySearch (query: "name in (ACCOUNTLISTREPLACEME)") {
          results {
            entities {
              accountId
              name
              tags {
                key
                values
              }
            }
            nextCursor
          }
          query
        }
      }
    }`

  //push the csv into the entitySearch() query
  oData = {query:cQuery.replace('ACCOUNTLISTREPLACEME',csvAppNames),variables:""}
  //console.log('payload:',oData)
  sURI = 'https://api.newrelic.com/graphql'
  var options = {
    method: 'post',
    url: sURI,
    data: oData,
    headers: {'Api-Key': GuserApiKey}
  }
  console.log('QueryAppNameList()-> NerdGraph query', sCursor)
  try {
    response = await axios(options)
		if (response.status != 200) {
      console.log('QueryAppNameList()-> failed:',response.status)
      throw ('axios dead')
    }
    if (response.data.errors){
      console.log('graphql errors:',response.data.errors)
      throw ('graphql errors')
    }
    var aRes = []
    var aApps = response.data.data.actor.entitySearch.results.entities
    for (oe of aApps){
      for (ot of oe.tags){
        if(ot.key.toLowerCase() == 'asv'){
          oe.asv = ot.values[0]  //could have multiple ASV values, picking first one
          break
        }
      }
      //debug
      //console.log('oe:',oe)
      aRes.push(oe)
      sCursor = response.data.data.actor.entitySearch.nextCursor
      //console.log('nextcursor:',sCursor)
    }
    return aRes
  } catch (e) {
    console.log('QueryAppNameList()->caught exception:',e)
    throw e
  }
}
//
//
//
async function main() {
  var qCursor

  //running a NRQL query to get a list of applications
  aApps = await GetAppNameList()

  //
  // now loop over applications and pull the tags
  aAppAsvs = await QueryAppNameLoop(aApps)
  aAppAsvs.sort((a,b) => {
    if(a.accountId == b.accountId){
      if(a.name > b.name){return 1} else {return -1}
    }
    if(a.accountId > b.accountId){return 1} else {return -1}
  })

  //dump the resulting list as csv to stdout
  aAppAsvs.forEach((val,idx) => {
    slog = [val.accountId,val.name,val.asv]
    console.log(slog.join(','))
  })

  console.log('number of java-6.1.0 APM-Services:',aAppAsvs.length)

}

main()
