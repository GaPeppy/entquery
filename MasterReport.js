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
async function GetReportData(cQuery, oAcct) {
  const METHODNAME = 'GetReportData'

  oData = {query:cQuery.replace('TARGETACCOUNTID',oAcct.id),variables:""}
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
    console.log('response nrql payload:',response.data.data.actor.account.nrql)
    console.log('response nrql.results payload:',response.data.data.actor.account.nrql.results)

    var aResults = response.data.data.actor.account.nrql.results

    aResponse = []
    for (oe of aResults){
      obj = {}
      obj.accountId = oAcct.id
      obj.accountName = oAcct.name
      for (el of Object.keys(oe)){
        if(el == 'facet'){
          if(Array.isArray(oe[el])) {
            for (ii=0;ii<oe[el].length;ii++){
              obj['f' + ii] = oe[el][ii]
            }
          } else {
            obj.f1 = oe[el]
          }
          continue
        }
        else if (el == 'location') {continue}
        obj[el] = oe[el]
      }
      aResponse.push(obj)
    }
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
async function main() {
  const METHODNAME = 'main'
  // nrql query from license data to get all accounts/apps for 6.1.0
  const cReportQuery = `{
  actor {
    account(id: TARGETACCOUNTID) {
      nrql(query: "SELECT rate(count(*),1 minute) as 'ChecksPerMinute' from SyntheticCheck WHERE locationLabel like 'cof%' FACET location since 12 hours ago limit 2000") {
        nrql
        otherResult
        totalResult
        results
      }
    }
  }
}`

  //running a NRQL query to get a list of Accounts
  var keymap = new Map()
  var mastercount = 0

  var actionlog = new FileLog('action.log')


  aAccounts = await GetAccountList()
  aAccounts.sort((a,b) => {if(a>b){return 1}else{return -1}})

  // loop over accounts, get the synthetics and then loop over the synthetics and update
  aReport = []
  for (oAcct of aAccounts){
    logit(METHODNAME,'working on account', oAcct)
    aTmp = await GetReportData(cReportQuery,oAcct)
    aReport = [...new Set([...aReport,...aTmp])]

  }

  for (oRpt of aReport){
    console.log(Object.values(oRpt).join(','))
  }

  actionlog.close()
  logit(METHODNAME,'MasterCount',mastercount)
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
