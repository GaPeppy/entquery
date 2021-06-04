const axios = require('axios')
const assert = require('assert')
const fs = require('fs')

//environmental input
const GuserApiKey = process.env.NEW_RELIC_USER_API_KEY
const GMasterUserID = process.env.NEW_RELIC_MASTER_USER_ID
const GAccountFilterCSV = process.env.NEW_RELIC_ACCOUNT_FILTER_CSV
const GTargetLocation = '2226777-cof_enterprise_nonprod_minions-799'
//const GTargetLocation = 'AWS_US_EAST_2'
const GReadOnly = false
//
//  GetAccountList()
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

    var tApps = response.data.data.actor.accounts
    //did we get an operational environmental control value to filter accounts?
    aApps = []
    if(typeof GAccountFilterCSV == 'string' && GAccountFilterCSV.length > 0){
      logit(METHODNAME,'filtering account list for',GAccountFilterCSV)
      var tmap = new Map()
      var atmp = GAccountFilterCSV.split(',')
      atmp.forEach(el => tmap.set(el,el))        //create map
      aApps = tApps.filter(el => tmap.has(el.id.toString()))   //filter account array
    } else {aApps = tApps}
    logit(METHODNAME,'Account List - aApps',aApps.length,aApps.length > 0 ? aApps[0] : 'nada')
    return aApps
  } catch (e) {
    logit(METHODNAME,'caught exception',e,oData)
    throw e
  }
}
//
//
//
async function GetKeyList(sMasterUserID) {
  const METHODNAME = 'GetKeyList'
  // nrql query from license data to get all accounts/apps for 6.1.0
  const cQuery = `{
  actor {
    apiAccess {
      keySearch(query: {types: USER, scope: {userIds: TARGETUSERIDS}}) {
        count
        keys {
          ... on ApiAccessUserKey {
            id
            name
            key
            type
            user {
              email
            }
            accountId
          }
        }
      }
    }
  }
}`

  oData = {query:cQuery.replace('TARGETUSERIDS',sMasterUserID),variables:""}
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

    var aApps = response.data.data.actor.apiAccess.keySearch.keys
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
async function GetSyntheticsList(sAccountID, sTargetLocation) {
  const METHODNAME = 'GetSyntheticsList'
  // nrql query from license data to get all accounts/apps for 6.1.0
  const cQueryCOF = `{
  actor {
    account(id: TARGETACCOUNTID) {
      nrql(query: "SELECT count(*) as 'ncnt',uniqueCount(location) as 'ucnt',filter(uniqueCount(location), where locationLabel not like 'cof%') as 'ucnt_notcof',latest(location) as 'exlocation' from SyntheticCheck WHERE locationLabel like 'cof%' and location not like 'TARGETLOCATION' FACET monitorId,monitorName,type since 1 day ago limit 2000") {
        nrql
        otherResult
        totalResult
        results
      }
    }
  }
}`
/***
const cQueryTest = `{
actor {
  account(id: TARGETACCOUNTID) {
    nrql(query: "SELECT count(*) as 'ncnt',uniqueCount(location) as 'ucnt',latest(location) as 'exlocation' from SyntheticCheck WHERE locationLabel not like 'TARGETLOCATION' FACET monitorId,monitorName,type since 1 day ago limit 2000") {
      nrql
      otherResult
      totalResult
      results
    }
  }
}
}`
***/

  oData = {query:cQueryCOF.replace('TARGETACCOUNTID',sAccountID).replace('TARGETLOCATION',sTargetLocation),variables:""}
  //console.log('payload:',oData)
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

    //debug
    //console.log('response nrql payload:',response.data.data.actor.account.nrql)

    var rApps = []
    var aApps = response.data.data.actor.account.nrql.results
    for (oe of aApps){
      rApps.push({consumingAccountName:sAccountID,monitorId:oe.facet[0],monitorName:oe.facet[1],monitorType:oe.facet[2], uLocationCount: oe.ucnt, uLocationCount_NotCOF: oe.ucnt_notcof})
    }
    logit(METHODNAME,'result array example',rApps.length,rApps.length > 0 ? rApps[0] : 'nada')
    return rApps
  } catch (e) {
    logit(METHODNAME,'caught exception',e,oData)
    throw e
  }
}
//
//  Read the REST API
//
async function GetSynthetic(sApiKey,sAccountID,sMonitorID) {
  const METHODNAME = 'GetSynthetic'

  //logit(METHODNAME,'getting',sAccountID, sMonitorID)

  sURI = 'https://synthetics.newrelic.com/synthetics/api/v3/monitors/' + sMonitorID
  var options = {
    method: 'get',
    url: sURI,
    headers: {'Api-Key': sApiKey}
  }

  //logit(METHODNAME,'NerdGraphing',options.method,options.url)
  try {
    response = await axios(options)
		if (response.status != 200 && response.status != 204) {
      logit(METHODNAME,'failed response.status',response.status)
      console.log('data:',response.data)
      console.log('options:',options)
      return false
    }
    return response.data
  } catch (e) {
    logit(METHODNAME,'caught exception',e)
    return false
  }
}
//
//  update through the old REST API
//
async function UpdateSyntheticLocation(sApiKey,sAccountID, sMonitorID, alocations) {
  const METHODNAME = 'UpdateSyntheticLocation'

  logit(METHODNAME,'updating monitor',sAccountID, sMonitorID, alocations)

  oData={"locations":alocations}
  sURI = 'https://synthetics.newrelic.com/synthetics/api/v3/monitors/' + sMonitorID
  var options = {
    method: 'patch',
    url: sURI,
    data: oData,
    headers: {'Api-Key': sApiKey}
  }

  logit(METHODNAME,'NerdGraphing',options.method,options.url)
  try {
    response = await axios(options)
		if (response.status != 200 && response.status != 204) {
      logit(METHODNAME,'failed response.status',response.status)
      console.log('data:',response.data)
      console.log('options:',options)
      return false
    }
    return true
  } catch (e) {
    logit(METHODNAME,'caught exception',e)
    return false
  }
}
//
// simple instance logger to filename
//
class FileLog {
  ///
  constructor(filename){
    if(filename == null){
      filename = path.basename(__filename).replace('.','_') + '_actionlog'
    }
    if(fs.existsSync(filename)){
      filename = filename + Date.now().toString()
    }
    this.filename = filename
    this.filehandle = fs.openSync(filename,'a')
    this.logit('FileLog.constructor','start log')
  }
  ///
  logdata(...theargs){
    if(this.filename == null){throw('filehandle is null')}
    if(theargs.length == 0)  {throw('logdata() requires at least one parameter')}

    var astring = []
    astring.push(Date.now())
    theargs.forEach((el) => {
      if ( typeof el == 'object'){
        astring.push('"' + JSON.stringify(el).replace(/"/g,'""') + '"')
      } else {astring.push(el)}
    })
    fs.appendFileSync(this.filehandle, astring.join(',')+'\n')
  }
  ///
  close(){
    if(this.filehandle) { this.logit('FileLog.close','stop log');fs.closeSync(this.filehandle); this.filehandle = null}
  }
  ///
  logit(mname,msg, ...theargs){
    if(this.filehandle == null)     {throw('filehandle is null')}
    if(mname == null || msg == null){throw('logit(method,msg,...) requires at least 2 params')}

    var newargs = [`[${(new Date()).toISOString()}]${mname}()-> ${msg}${theargs.length == 0 ? '' : ':'}`]
    theargs.forEach((el) => {
      if ( typeof el == 'object'){
        newargs.push('"' + JSON.stringify(el).replace(/"/g,'""') + '"')
      } else {newargs.push(el)}
    })
    fs.appendFileSync(this.filehandle,newargs.join('|||') + '\n')
  }
} //class FileLog

//stdout logger
function logit(mname,msg, ...theargs){
  if(mname == null || msg == null){throw('logit(method,msg,...) requires at least 2 params')}
  console.log(`[${(new Date()).toISOString()}]${mname}()-> ${msg}${theargs.length == 0 ? '' : ':'}`,...theargs)
}
//
//
//
async function main() {
  const METHODNAME = 'main'
  //running a NRQL query to get a list of Accounts
  var keymap = new Map()
  var mastercount = 0

  var actionlog = new FileLog('action.log')


  aAccounts = await GetAccountList()
  aAccounts.sort((a,b) => {if(a>b){return 1}else{return -1}})
  aKeys = await GetKeyList(GMasterUserID)
  //convert array into a map
  aKeys.forEach(el => keymap.set(el.accountId,el.key))
  logit(METHODNAME,'dumping map',Array.from(keymap.keys()))



  // loop over accounts, get the synthetics and then loop over the synthetics and update
  for (oAcct of aAccounts){
    var iStart = Date.now()
    logit(METHODNAME,'working on account', oAcct)
    sSecret = keymap.get(oAcct.id)
    if(typeof sSecret != 'string'){
      logit(METHODNAME,'!!!i got no key, skipping entire account!!!', oAcct)
      throw('!!!where is my secret!!!')
    }
    aSyn = await GetSyntheticsList(oAcct.id, GTargetLocation)
    if(aSyn.length >= 2000)
    {
      logit(METHODNAME,'!!!hit the wall - die hard!!! Syn Query returned 2,000')
      throw('!!!hit the wall - die hard!!! Syn Query returned 2,000')
    }

    for (oSyn of aSyn){
      await new Promise(resolve => setTimeout(resolve, 250))
      mastercount++
      var bRet = false
      var originallocations = [], newlocations = []
      bRet = await GetSynthetic(sSecret, oAcct.id,oSyn.monitorId)
      if (typeof bRet == 'object'){
          originallocations = bRet.locations
          for (var ii=0; ii < originallocations.length;ii++){
            newlocations.push(originallocations[ii])
            if (newlocations[ii].toLowerCase().indexOf('-cof_') > -1){
              newlocations[ii] = GTargetLocation
            }
          }
          //
          // Tip of the spear
          //
          if (GReadOnly === false){
            bRet = await UpdateSyntheticLocation(sSecret,oAcct.id,oSyn.monitorId,newlocations)
          }
      }
      actionlog.logdata(bRet==true ? 'success' : 'failed',oAcct.id,oSyn.monitorId,oSyn.monitorName,originallocations,newlocations)
    }
    logit(METHODNAME,'processed # in sec',aSyn.length,((Date.now()-iStart)/1000))
  }
  actionlog.close()
  logit(METHODNAME,'MasterCount',mastercount)
}
// crank it up
main()
