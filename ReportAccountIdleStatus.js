const axios = require('axios')
const assert = require('assert')
const fs = require('fs')

//environmental input
const GuserApiKey = process.env.NEW_RELIC_USER_API_KEY
const GMasterUserID = process.env.NEW_RELIC_MASTER_USER_ID
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
async function retryf(functionname, oAcct, retries=2){
  const METHODNAME = 'retryf'
  for(ii=0;ii<retries;ii++){
    try{
      return (await functionname(oAcct))
    }
    catch (e){
      if(ii >= retries-1){
        logit(METHODNAME,'hard die',e)
        throw e
      }
      logit(METHODNAME,'eating error and retrying',functionname.name,ii)
    }
  }
}
//
//
//
async function GetItAll(oAcct) {
  const METHODNAME = 'GetItAll'
  const cQuery = `{
      actor {
        entitySearch(query: "type IN ('MONITOR') and accountId = 'TARGETACCOUNTID'") {
          count
          query
        }
        account(id: TARGETACCOUNTID) {
          cloud {
            linkedAccounts {
              integrations {
                id
                name
                service {
                  id
                  slug
                  isEnabled
                  name
                }
              }
            }
          }
          apm: nrql(query: "SELECT uniqueCount(apmAppName) FROM NrDailyUsage where productLine = 'APM' since 1 day ago") {
            nrql
            totalResult
            results
          }
          browser: nrql(query: "SELECT uniqueCount(browserAppId) FROM NrUsage where productLine = 'Browser' since 1 day ago") {
            nrql
            totalResult
            results
          }
          synthetics: nrql(query: "SELECT uniqueCount(syntheticsMonitorId) FROM NrDailyUsage where productLine = 'Synthetics' since 1 day ago") {
            nrql
            totalResult
            results
          }
          infra: nrql(query: "SELECT uniqueCount(agentHostname) FROM NrDailyUsage where productLine = 'Infrastructure' since 1 day ago") {
            nrql
            totalResult
            results
          }
          mobile: nrql(query: "SELECT uniqueCount(mobileAppId) FROM NrDailyUsage where productLine = 'Mobile' since 1 day ago") {
            nrql
            totalResult
            results
          }
        }
      }
    }`
  oData = {query:cQuery.replace(/TARGETACCOUNTID/g,oAcct.id),variables:""}
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
      logit(METHODNAME,'nronly',response.data.errors.nrOnly)
      throw (`${METHODNAME}()->graphql errors`)
    }

    //debug
    console.log('response nrql.results payload:',response.data.data.actor.account)
    aptr = response.data.data.actor.account
    oResponse = {}
    oResponse.accountId = oAcct.id
    oResponse.accountName = oAcct.name
    oResponse.apm = aptr.apm.results[0][Object.keys(aptr.apm.results[0])[0]]
    oResponse.browser = aptr.browser.results[0][Object.keys(aptr.browser.results[0])[0]]
    oResponse.mobile = aptr.mobile.results[0][Object.keys(aptr.mobile.results[0])[0]]
    oResponse.infra = aptr.infra.results[0][Object.keys(aptr.infra.results[0])[0]]

    //do not use active synthetics count but instead get all synthetics thru entitySearch
    //oResponse.synthetics = aptr.synthetics.results[0][Object.keys(aptr.synthetics.results[0])[0]]
    var oES = response.data.data.actor.entitySearch
    oResponse.synthetics = oES.count

    var aLinkedAccounts = response.data.data.actor.account.cloud.linkedAccounts
    oResponse.awslinkedcount = aLinkedAccounts.length
    oResponse.awslist = ''
    if (Array.isArray(aLinkedAccounts)){
      alist = []
      for (ala of aLinkedAccounts){
        //console.log('ala:',ala)
        for (obj of ala.integrations){
          if (obj.service.isEnabled == true){
            alist.push(obj.name)
          }
        }
      }
      oResponse.awslist = '"' + alist.join(',') + '"'
    }

    logit(METHODNAME,'oResponse',oResponse)
    return oResponse
  } catch (e) {
    logit(METHODNAME,'caught exception',e,oData)
    throw e
  }
}
//
//
//
async function main() {
  const METHODNAME = 'main'
  var actionlog = new FileLog('action.log')

  aAccounts = await GetAccountList()
  aAccounts.sort((a,b) => {if(a>b){return 1}else{return -1}})

  // loop over accounts, get product usage data including cloud-integrations
  aReport = []
  var ii = 0
  var nDcnt = 0
  for (oAcct of aAccounts){
    ii++
    logit(METHODNAME,'working on account', oAcct, ii)
    //oAWSList = await retryf(GetAWSList,oAcct)
    //oSub = await retryf(GetSubscriptionData,oAcct)
    //oReport = { ...oAWSList, ...oSub}
    oReport = await retryf(GetItAll,oAcct)
    if (oReport.synthetics == 0 && oReport.apm == 0 && oReport.infra == 0 && oReport.mobile == 0
        && oReport.browser == 0 && oReport.awslist == '""') {
      oReport.Delete = true; nDcnt++
    } else {oReport.Delete = false}
    aReport.push(oReport)
    actionlog.logdata(oReport)

    //debug line
    //if (ii > 20) {break}
  }

  ifirst = true
  for (oRpt of aReport){
    if (ifirst) {console.log(Object.keys(oRpt).join(',')); ifirst=false}
    console.log(Object.values(oRpt).join(','))
  }

  actionlog.close()
  logit(METHODNAME,'MasterCount',aReport.length, nDcnt)
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
        astring.push('"' + JSON.stringify(el).replace('"','""') + '"')
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
        newargs.push('"' + JSON.stringify(el).replace('"','""') + '"')
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

// crank it up
main()
