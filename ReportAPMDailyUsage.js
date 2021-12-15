const axios = require('axios')
const assert = require('assert')
const fs = require('fs')

//environmental input
const GuserApiKey = process.env.NEW_RELIC_USER_API_KEY
const GQueryAccountId = process.env.NEW_RELIC_QUERY_ACCOUNT_ID
const GQueryAccountName = process.env.NEW_RELIC_QUERY_ACCOUNT_NAME
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
    //console.log('response nrql payload:',response.data.data.actor.account.nrql)
    //console.log('response nrql.results payload:',response.data.data.actor.account.nrql.results)

    var aResponse = response.data.data.actor.account.nrql.results

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
  const cFirstQuery = `{
  actor {
    account(id: TARGETACCOUNTID) {
      nrql(query: "SELECT * from NrDailyUsage where productLine = 'APM' and usageType = 'Application' since 1 day ago order by apmAppInstanceId limit max") {
        nrql
        otherResult
        totalResult
        results
      }
    }
  }
}`
  const cNextQuery = `{
  actor {
    account(id: TARGETACCOUNTID) {
      nrql(query: "SELECT * FROM NrDailyUsage WHERE productLine = 'APM' and usageType = 'Application' and apmAppInstanceId > 'LASTAPMAPPINSTANCEID' SINCE 1 day ago ORDER BY apmAppInstanceId limit max") {
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
  var dupecount = 0

  var actionlog = new FileLog('APMDailyUsage.log')


  var oAcct = {id:GQueryAccountId,name:GQueryAccountName}
  var sLastApmInstanceId = ''
  aReport = []
  for(ii=0;ii<500;ii++){
    if(ii==0){
      aTmp = await GetReportData(cFirstQuery,oAcct)
      actionlog.logdata(Object.keys(aTmp[0]).join(','))
      logit(METHODNAME,'processing First aTmp',aTmp.length)
    } else {
      if(sLastApmInstanceId == '') {throw 'sLastApmInstanceId is blank'}
      aTmp = await GetReportData(cNextQuery.replace('LASTAPMAPPINSTANCEID',sLastApmInstanceId),oAcct)
      logit(METHODNAME,'processing Next aTmp',aTmp.length, ii, mastercount,dupecount)
    }
    if(aTmp.length == 0){
      logit(METHODNAME,'aTmp is empty, stepping out')
      break
//    } else if (aTmp.length < 2000){
//      break
    } else {
      mastercount += aTmp.length
      aTmp.forEach(item => {
        if(keymap.has(item.apmAppInstanceId)){
          dupecount++
        } else {
          actionlog.logdata(Object.values(item).join(','))
          keymap.set(item.apmAppInstanceId,item.apmAppName)
        }
      })
      sLastApmInstanceId = aTmp[aTmp.length-1].apmAppInstanceId
      logit(METHODNAME,'deriving Last ApmInstanceId',sLastApmInstanceId, ii, mastercount,dupecount)
    }
  } //loop with master-cap

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
//    astring.push(Date.now())
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
