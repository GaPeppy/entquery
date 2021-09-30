const axios = require('axios')
const assert = require('assert')
const fs = require('fs')

//environmental input
const GuserApiKey = process.env.NEW_RELIC_USER_API_KEY
const GAccountFilterCSV = process.env.NEW_RELIC_ACCOUNT_FILTER_CSV
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
async function GetNRIAOSList(oAcct) {
  const METHODNAME = 'GetNRIAOSList'
  // nrql query from license data to get all accounts/apps for 6.1.0
  const cQuery = `{
  actor {
    account(id: TARGETACCOUNTID) {
      nrql(query: "FROM SystemSample select uniqueCount(entityGuid) as 'ucnt' facet operatingSystem,linuxDistribution,kernelVersion,windowsPlatform,windowsVersion limit 2000") {
        nrql
        otherResult
        totalResult
        results
      }
    }
  }
}`

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

    var rApps = []
    var aApps = response.data.data.actor.account.nrql.results
    for (oe of aApps){
      //operatingSystem,linuxDistribution,kernelVersion,windowsPlatform,windowsVersion
      if (oe.facet[0] == 'linux'){
        rApps.push({consumingAccountID:oAcct.id,consumingAccountName:oAcct.name,OSType:oe.facet[0],distribution:oe.facet[1],OSVersion:oe.facet[2],ucnt:oe.ucnt})
      } else {
        rApps.push({consumingAccountID:oAcct.id,consumingAccountName:oAcct.name,OSType:oe.facet[0],distribution:oe.facet[3],OSVersion:oe.facet[4],ucnt:oe.ucnt})
      }
      //rApps.push({consumingAccountName:sAccountID,NoNRIA:oe.facet[0],operatingSystem:oe.facet[1],linuxDistribution:oe.facet[2],kernelVersion: oe.facet[3],windowsPlatform: oe.facet[4],windowsVersion:oe.facet[5], ucnt:oe.ucnt})
    }
    logit(METHODNAME,'result array example',rApps.length,rApps.length > 0 ? rApps[0] : 'nada')
    return rApps
  } catch (e) {
    logit(METHODNAME,'caught exception',e,oData)
    throw e
  }
}
//
//
//
async function GetEC2CountNoAgent(oAcct) {
  const METHODNAME = 'GetEC2CountNoAgent'
  // nrql query from license data to get all accounts/apps for 6.1.0
  const cQuery = `{
  actor {
    account(id: TARGETACCOUNTID) {
      nrql(query: "FROM ComputeSample select uniqueCount(entityGuid) as 'ucnt' where provider ='Ec2Instance' and linuxDistribution is null and windowsPlatform is null") {
        nrql
        otherResult
        totalResult
        results
      }
    }
  }
}`

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

    var rApps = []
    var aApps = response.data.data.actor.account.nrql.results
    for (oe of aApps){
      rApps.push({consumingAccountID:oAcct.id,consumingAccountName:oAcct.name,OSType:'unknown',distribution:'unknown',OSVersion:'unknown',ucnt:oe.ucnt})
    }
    logit(METHODNAME,'result array example',rApps.length,rApps.length > 0 ? rApps[0] : 'nada')
    return rApps
  } catch (e) {
    logit(METHODNAME,'caught exception',e,oData)
    throw e
  }
}
//
// simple instance logger to filename
//
class FileLog {
  filename
  filehandle
  ///
  constructor(pfilename){
    var vfn = pfilename
    if(pfilename == null){
      vfn = path.basename(__filename).replace('.','_') + '_actionlog'
    }
    if(fs.existsSync(vfn)){
      vfn = pfilename + Date.now().toString()
    }
    this.filename = vfn
    this.filehandle = fs.openSync(vfn,'a')
    this.logit('FileLog.constructor','start log')
  }
  ///
  get filename(){
    return this.filename
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
//
//
//
async function main() {
  const METHODNAME = 'main'
  //running a NRQL query to get a list of Accounts
  var aRpt = []
  var actionlog = new FileLog('results.csv')


  aAccounts = await GetAccountList()
  aAccounts.sort((a,b) => {if(a>b){return 1}else{return -1}})


  // loop over accounts, get the synthetics and then loop over the synthetics and update
  for (oAcct of aAccounts){
    logit(METHODNAME,'working on account', oAcct)
    aSystemSample = await GetNRIAOSList(oAcct)
    aComputeSample = await GetEC2CountNoAgent(oAcct)
    aRpt.push(aSystemSample)
    aRpt.push(aComputeSample)
  }

  logit(METHODNAME,`Generating csv file[${actionlog.filename}] with [${aRpt.length}] rows`)
  //turn aRpt into csv file
  actionlog.logdata('NrAccountID,NrAccountName,OSType,OSDistribution,OSVersion,HostCount')
  aRpt.forEach(i => i.forEach( j => actionlog.logdata(Object.values(j).join(','))))
  actionlog.close()
  logit(METHODNAME,'finished ... headed for the bar')
}
// crank it up
main()
