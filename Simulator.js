var fs = require("fs");	
var querystring = require("querystring");
var https = require("https");
var host = 'api.havenondemand.com';

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var http = require('http');
var concat = require('concat-stream');

app.set('port', process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8081);
app.set('ip', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");


http.createServer(app).listen(app.get('port') ,app.get('ip'), function () {
    console.log("✔ Express server listening at %s:%d ", app.get('ip'),app.get('port'));    
});



var current_JOBID = "";
var jobPath = "https://api.havenondemand.com/1/job/result/";
var api_key = "apikey=53656730-a649-4644-9b95-4d347eb831be";
var outputValue = ""
var index = 0;

var simulationExecution = {
	//simulation_results : [],
	readJSONFile : function(jsonInput){
		this.input  = jsonInput;// fs.readFileSync( "simulation.json", 'utf8');  
		//console.log("Input : " + JSON.stringify(this.input));		
	},
	getJobResult : function(jobId,simulationCallback){
		console.log("Checking job ID");
		var endpoint = jobPath + jobId + '?' + api_key ;
		console.log(endpoint);
		var options = {
		host: host,
		path: endpoint,
		method: 'GET',
		};

		var req = https.request(options, function(res) {
		res.setEncoding('utf-8');

		var responseString = '';

		res.on('data', function(data) {
		  console.log(data + " end.")
		  responseString += data;
		});

		res.on('end', function(data) {
		  //console.log(responseString);
		  var responseObject = JSON.parse(responseString);
		  //console.log(responseObject);		  
		  console.log("Callback is executing.");
		  simulationCallback(responseObject);
		  //	console.log(responseObject);
		});
		});
		req.write(api_key);
		req.end();
	},
	executeSimulation : function() {	
		//var simulationSteps = JSON.parse(this.input);	
		console.log("Current index: " + this.index);
		console.log("Simulation steps: " + this.simulationSteps);
		if(this.index < this.simulationSteps.length){
		 	var simulation = this.simulationSteps[this.index];
		 	simulation.request = this.processRequestParams(simulation.request);	
		 	current_JOBID = undefined;	 		 	
		 	this.performRequest(simulation.api_url,'GET',simulation.request,simulationCallback);
		 	this.isStepExecuted = true;
		 	this.index++;
		 	//this.post(simulation.simulation_id,simulation.api_url,simulation.request, "POST");
		}		 		 
	},
	simulationDriver : function(){
		this.simulation_results = new Array();
		this.simulationSteps = this.input;
		this.index = 0;
		this.executeSimulation();
	},
	processRequestParams : function(requestParams){
		if(outputValue != ""){
			Object.keys(requestParams).forEach(function(item,index){
				requestParams[item] = outputValue;
			});
		}
		return requestParams;
	},
	performRequest : function(endpoint, method, data, simulationCallback) {
		var dataString = JSON.stringify(data);
		var headers = {};

		if (method == 'GET') {
		endpoint += '?' + api_key + "&"+ querystring.stringify(data);
		}
		else {
		headers = {
		  'Content-Type': 'application/json',
		  'Content-Length': dataString.length

		};
		}
		console.log("Endpoint: " + endpoint);
		var options = {
		host: host,
		path: endpoint,
		method: method,
		headers: headers
		};

		var req = https.request(options, function(res) {
		res.setEncoding('utf-8');

		var responseString = '';

		res.on('data', function(data) {
		  responseString += data;
		});

		res.on('end', function(data) {
		  console.log(responseString);
		  var responseObject = JSON.parse(responseString);
		  console.log(responseObject.jobID);
		  //current_JOBID = responseObject.jobID;
		  simulationCallback(responseObject);
		  
		});
	});
		console.log("Data string: "+dataString);
		req.write("");
		req.end();
	}

}
function isArray(what) {
    return Object.prototype.toString.call(what) === '[object Array]';
}
function getJSONKeyValue(myJSON,outputKey){
	var keys = outputKey.split(".");
	outputValue = "";
	keys.forEach(function(item,index){
		if(myJSON.hasOwnProperty(item)){
			if(isArray(myJSON[item])){
				myJSON = myJSON[item][0];
			}
			else{
				myJSON = myJSON[item];
			}	
		}		
	});
	return myJSON;
	
}

function checkJobStatusCallback(jobID){
	simulationExecution.getJobResult(jobID,simulationCallback);
}
function simulationCallback(responseObject){

	if(responseObject.jobID != undefined && responseObject.status == undefined){
		console.log("JobId: " + responseObject.jobID)
		checkJobStatusCallback(responseObject.jobID);
	}
	else{
		var index = simulationExecution.index - 1;
		var outputKey = simulationExecution.simulationSteps[index].response
		outputValue = JSON.stringify(getJSONKeyValue(responseObject,outputKey));
		console.log("Output value :" + outputValue);
		simulationExecution.executeSimulation();
	}	
}

app.use(bodyParser.json());

app.post('/executeSimulation', function (req, response){
	console.log(req.body);
	simulationExecution.input = req.body;
	simulationExecution.simulationDriver();
	response.send(outputValue);
	
});

app.get('/getResult',function(req,res){
	res.send(outputValue);
})

exports.simulationHandler = function(event, context) {
 	//simulationExecution.readJSONFile(event);

	simulationExecution.simulationDriver(); 
}

//console.log("Input : " + JSON.parse(simulationExecution.input)[0]);
