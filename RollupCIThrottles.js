const axios = require('axios')
const assert = require('assert')
const fs = require('fs')

//environmental input
const GuserApiKey = process.env.NEW_RELIC_USER_API_KEY
const GMasterInsertKey = process.env.NEW_RELIC_MASTER_INSERT_KEY
const GMasterAccountId = process.env.NEW_RELIC_MASTER_ACCOUNT_ID
const GTARGETEVENTTYPE = "CloudIntegrationThrottleErrorsRollup"
//
//
//
async function GetAccountList() {
  const METHODNAME = 'GetAccountList'
  // nrql query from license data to get all accounts/apps for 6.1.0
  const cQuery = `{
  actor {
    accounts {
      id
      name
    }
  }
}`

  oData = {query:cQuery,variables:""}
  //console.log('payload:',oData)
  sURI = 'https://api.newrelic.com/graphql'
  var options = {
    method: 'post',
    url: sURI,
    data: oData,
    headers: {'Api-Key': GuserApiKey}
  }

  logit(METHODNAME,'Nerdgraphing',options.method,options.url)
  try {
    response = await axios(options)
		if (response.status != 200) {
      logit(METHODNAME,'failed response.status',response.status)
      throw ('axios dead')
    }
    if (response.data.errors){
      logit(METHODNAME,'graphql errors',response.data.errors)
      throw (`${METHODNAME}()->graphql errors`)
    }

    var aApps = response.data.data.actor.accounts
    logit(METHODNAME,'rApps',aApps.length,aApps.length > 0 ? aApps[0] : 'nada')
    return aApps
  } catch (e) {
    logit(METHODNAME,'caught exception',e,oData)
    throw e
  }
}
//
//
//
async function GetReportData(aAccounts) {
  const METHODNAME = 'GetReportData'

  var sQuery = GenerateQuery(aAccounts)
  oData = {query:sQuery,variables:""}
  sURI = 'https://api.newrelic.com/graphql'
  var options = {
    method: 'post',
    url: sURI,
    data: oData,
    headers: {'Api-Key': GuserApiKey}
  }

  logit(METHODNAME,'Nerdgraphing', options.method,options.url)
  try {
    response = await axios(options)
		if (response.status != 200) {
      logit(METHODNAME,'failed',response.status)
      throw ('axios dead')
    }
    if (response.data.errors){
      logit(METHODNAME,'graphql errors',response.data.errors)
      throw (`${METHODNAME}()->graphql errors`)
    }

    var respobj=response.data.data.actor
    //debug
    //console.log('response nrql payload:',respobj)

    var aResponse = []
    Object.keys(respobj).forEach((k) => {
      respobj[k].nrql.results.forEach((item) => {
        item.NrAccountId = k.substring(1)
        item.eventType = GTARGETEVENTTYPE
        aResponse.push(item)
      })
    })
    logit(METHODNAME,'aResponse',aResponse.length,aResponse.length > 0 ? aResponse[0] : 'nada')
    return aResponse

  } catch (e) {
    logit(METHODNAME,'caught exception',e,oData)
    throw e
  }
}
//
//
//
async function UploadToMaster(aRecords) {
  const METHODNAME = 'UploadToMaster'

  sURI = `https://insights-collector.newrelic.com/v1/accounts/${GMasterAccountId}/events`
  var options = {
    method: 'post',
    url: sURI,
    data: aRecords,
    headers: {'X-Insert-Key': GMasterInsertKey}
  }

  logit(METHODNAME,'Event API', options.method,options.url)
  try {
    response = await axios(options)
		if (response.status != 200) {
      logit(METHODNAME,'failed',response.status)
      throw ('axios dead')
    }
    return true
  } catch (e) {
    logit(METHODNAME,'caught exception',e,aRecords)
    throw e
  }
}
//
//
//
function GenerateQuery(aAccounts){
  const METHODNAME='GenerateQuery'
  const QUERYTEMPLATE='aREPLACEME: account(id: REPLACEME) {\n      nrql(query: \"SELECT * FROM (SELECT sum(throttleException) as \u0027throttlingErrors\u0027 FROM IntegrationProviderReport FACET providerAccountName,awsRegion,awsServiceName,method limit 2000) WHERE throttlingErrors > 0 SINCE 1 hour ago LIMIT 2000\") {\n        results\n        nrql\n      }\n    }'

  //iterate over all accounts and generate one massive nerdgraph parallel query
  var aquery = []
  for (oAcct of aAccounts){
    aquery.push(QUERYTEMPLATE.replace(/REPLACEME/g,oAcct.id))
  }

  return `{\n actor {\n ${aquery.join('\n')}\n }\n} `
}
//
//
//
async function main() {
  const METHODNAME = 'main'

  var aAccounts = await GetAccountList()
  var aRecords = await GetReportData(aAccounts)
  var bdone = await UploadToMaster(aRecords)
  console.log('report',aRecords)

  logit(METHODNAME,'MasterCount',aRecords.length)
}

//stdout logger
function logit(mname,msg, ...theargs){
  if(mname == null || msg == null){throw('logit(method,msg,...) requires at least 2 params')}
  console.log(`[${(new Date()).toISOString()}]${mname}()-> ${msg}${theargs.length == 0 ? '' : ':'}`,...theargs)
}

// crank it up
main()
