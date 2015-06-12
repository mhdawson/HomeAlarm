// Copyright 2014-2015 the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.
var mqtt = require('mqtt');
var https = require('https');
var http = require('http');
var path = require('path');
var fs = require('fs');
var auth = require('basic-auth');
var twilio = require('twilio');
var WebSocketServer = require('websocket').server;

// constants
var NUM_ZONES = 8;
var ZONE_STATUS = '/status';
var ZONE_NAME = '/name';
var CAMERA_CAPTURE = '/capture';
var CAMERA_NEWPICTURE = '/newpicture';

// exit codes
var INVALID_SERVER_PORT = -1;

// server configurations
var ssl_options = null;
var serverPort = 8080;
var mqttServerUrl = '';
var mqttRootTopic = null;
var alarmStatusTopic = null;
var zoneTopicPrefix = null;
var eventLogPrevix = null;
var eventLogFile = null;
var title = '';
var webserverUrlForPictures = '';

// alarm state and data
var alarmSite = '';
var latestData = {};
var zoneMapping = {};

// client connections data
var numClients = 0;
var clientArray = {};

// twillio configuration data
var twilioAccountSID;
var twilioAccountAuthToken;
var twilioFromNumber;
var twilioToNumber

// camera configuration
var cameraTopic;
var cameraIRtopic = undefined;
var cameraIRon = undefined;
var cameraIRoff = undefined;
var newPictureTopic;
var cameraCaptureTopic;
var pictureTimer = null;
var picture1 = '';
var picture2 = '';
var picture3 = '';
var picture4 = '';

// for secure connection to mqtt server
var mqttOptions = '';

// authenticate requests to the alarm console
var username = '';
var password;
function authenticate(request,response) {
   var authInfo = auth(request);
   if (!authInfo || username=='' || authInfo.name !== 'alarm' || authInfo.pass !== password ) {
      if (response !== undefined) {
         response.writeHead(401, {'WWW-Authenticate': 'Basic realm="alarm"'});
         response.end();
      }
      return false;
   }
   return true;
}

// function to request that a picture be taken
var irTimer = undefined;
function takePicture() {
   irOn();
   irOn();
   irOn();

   // leave some time for the ir light to illuminate
   setTimeout(function() {
                 client.publish(cameraCaptureTopic, 'take');
              }, 10);

   // now give the pi 60 seconds to take the picture
   // and then turn off the ir light.  If another
   // picture request comes before the first one
   // is complete the timer is reset so we should
   // always get 60s after the request for the last
   // picture
   if (irTimer != undefined) {
      clearInterval(irTimer);
   }
   irTimer = setInterval(function() {
                           irOff();
                           irOff();
                           irOff();
                           clearInterval(irTimer);
                           irTimer = undefined;
                         }, 30000);
}

// used to log alarm events
function logEvent(event) {
   // not goint to provide error function as we won't do 
   // anything in case of an error
   fs.appendFile(eventLogFile, new Date() + ' :' + event + '\n');
}

// read in the configuration data
function readConfig(configFile) {
   ssl_options = {
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem'),
   }
   data = fs.readFileSync(configFile);
   var lines = data.toString().split('\n');
   for (line in lines) {
      var configParts = lines[line].split('=');
      if (1 < configParts.length) {
         var configKey = configParts[0];
         var configValue = configParts[1];
         if ('port' == configKey) { 
            serverPort = configValue;
            if(isNaN(serverPort)) {
               logEvent('Invalid server port:' + serverPort);
               process.exit(INVALID_SERVER_PORT);
            }
         } else if ('zone' == configKey) {
            var parts = configValue.split(':');
            if (1 < parts.length) {
               var sensorTopic = parts[0];
               var zone = parts[1];
               if ((0 <zone) && ( NUM_ZONES >= zone )) {
                  zoneMapping[sensorTopic] = zoneTopicPrefix + zone + ZONE_STATUS;
                  if (2 < parts.length) {
                     // add the description
                     latestData[zoneTopicPrefix + zone + ZONE_NAME] = parts[2];
                  }
               } else {
                  logEvent('Invalid zone:' + zone);
               }
            }
         } else if ('mqttRootTopic' == configKey) {
             mqttRootTopic = configValue;
             alarmStatusTopic = mqttRootTopic +  '/alarm/status';
             zoneTopicPrefix = mqttRootTopic + '/alarm/zone/';
         } else if ('mqttServerUrl' == configKey) {
             mqttServerUrl = configValue;
         } else if ('eventLogPrefix' == configKey) {
             eventLogPrefix = configValue;
             eventLogFile = eventLogPrefix + path.sep + 'alarm_event_log';
         } else if ('twilioAccountSID' == configKey) {
            twilioAccountSID = configValue;
         } else if ('twilioAccountAuthToken' == configKey) {
            twilioAccountAuthToken = configValue;
         } else if ('twilioFromNumber' == configKey) {
            twilioFromNumber = configValue;
         } else if ('twilioToNumber' == configKey) {
            twilioToNumber = configValue;
         } else if ('alarmSite' == configKey) {
             alarmSite = configValue;
         } else if ('cameraTopic' == configKey) {
             cameraTopic = configValue;
             newPictureTopic = cameraTopic + CAMERA_NEWPICTURE;
             cameraCaptureTopic = cameraTopic + CAMERA_CAPTURE;
         } else if ('username' == configKey) {
             username = configValue;
         } else if ('cameraIRtopic' == configKey) {
             cameraIRtopic = configValue;
         } else if ('cameraIRon' == configKey) {
             cameraIRon = configValue;
         } else if ('cameraIRoff' == configKey) {
             cameraIRoff = configValue;
         } else if ('password' == configKey) {
             password = configValue;
         } else if ('title' == configKey) {
             title = configValue;
         } else if ('webserverUrlForPictures' == configKey) {
             webserverUrlForPictures = configValue;
         } else if ('certsDir' == configKey) {
            mqttOptions = {
               key: fs.readFileSync(configValue + '/client.key'),
               cert: fs.readFileSync(configValue + '/client.cert'),
               ca: fs.readFileSync(configValue + '/ca.cert'),
               checkServerIdentity: function() { return undefined }
            }
         }
      }
   }
}

function irOn() {
   if ((undefined != cameraIRtopic) && (undefined != cameraIRon)) {
      client.publish(cameraIRtopic, cameraIRon);
   }
}

function irOff() {
   if ((undefined != cameraIRtopic) && (undefined != cameraIRoff)) {
      client.publish(cameraIRtopic, cameraIRoff);
   }
}


readConfig(process.argv[2]);
logEvent('Read configuration');

// setup the websocket/server enpoint
var mainPage = fs.readFileSync('page.html').toString();
mainPage = mainPage.replace('<ALARM DASHBOARD TITLE>', title);
mainPage = mainPage.replace('<UNIQUE_WINDOW_ID>', title);
mainPage = mainPage.replace('<WEBSERVER_URL>', webserverUrlForPictures);
mainPage = mainPage.replace('<WEBSERVER_URL>', webserverUrlForPictures);
mainPage = mainPage.replace('<WEBSERVER_URL>', webserverUrlForPictures);
var server = https.createServer(ssl_options, function(request,response) {

   if (!authenticate(request, response)) { 
      return;
   } 

   // ok now server the appropriate page base on the request type
   if (request.url.indexOf("getlog") > -1) {
      var logFile = fs.readFileSync(eventLogFile);
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end(logFile);
      return;
   } 
   response.writeHead(200, {'Content-Type': 'text/html'});
   response.end(mainPage);
});

server.listen(serverPort,function(){
});;

wsServ = new WebSocketServer({
   httpServer:server
});

wsServ.on('request', function(newRequest) {
   if (!authenticate(newRequest.httpRequest)) { 
      return;
   } 

   // ok now server the appropriate page base on the request type
   // accept connection and add to the list of clients
   var newConnection = newRequest.accept('text',newRequest.origin);
   var id = numClients++;
   clientArray[id] = newConnection;

   for (key in latestData) {
      newConnection.sendUTF(key + ":" + latestData[key]);
   } 

   // send the latest pictures
   newConnection.sendUTF(newPictureTopic + ":" + picture4);
   newConnection.sendUTF(newPictureTopic + ":" + picture3);
   newConnection.sendUTF(newPictureTopic + ":" + picture2);
   newConnection.sendUTF(newPictureTopic + ":" + picture1);

   // when client disconnections remove it from the list
   newConnection.on('close', function(reason,description) {
      delete clientArray[id];
   });

   newConnection.on('message', function(message) {
      var parts = message.utf8Data.split(":");
      var topic = parts[0];
      var value = parts[1];
      if (topic == alarmStatusTopic) { 
         client.publish(topic, value); 
      } else if (topic == cameraCaptureTopic) { 
         takePicture();
      } 
   });

});

var client = mqtt.connect(mqttServerUrl, mqttOptions);

/* each time we connect register on all topics we are interested
 * in.  This must be done after a reconnect as well as the 
 * initial connect
 */
client.on('connect',function() {
   client.subscribe(alarmStatusTopic);
   client.subscribe(zoneTopicPrefix + '+/+');
   client.subscribe(newPictureTopic);
   for(topic in zoneMapping) { 
      client.subscribe(topic);
   }
});

client.on('message', function(topic, message) {
   latestData[topic] = message;
   if (alarmStatusTopic == topic) { 
      if (('arm' == message) || ('disarm' == message)) {
         // first clear the state of all of the zones
         for(i=1;i < NUM_ZONES+1; i++) { 
            client.publish(zoneTopicPrefix + i + ZONE_STATUS, 'off'); 
         } 
         // stop taking pictures if we are as we are reseting the alarm state
	 if (null != pictureTimer) {
            clearInterval(pictureTimer);
         }

         if ('arm' == message) {
            logEvent('Armed');
         } else {
            logEvent('Dis-Armed');
         }
      } else if ('triggered' == message) {
         logEvent('Alarm Triggered:' + Date());

         // take pictures every 10 seconds for 5 minutes after the alarm is triggered
         var count = 0;
         pictureTimer = setInterval(function() {
            takePicture();
            count++;
            if (30 < count) {
               clearInterval(pictureTimer);
            }
         }, 10000);

         // send sms message indicating alarm has been triggered
         var twilioClient = new twilio.RestClient(twilioAccountSID, twilioAccountAuthToken);
         twilioClient.sendMessage({
            to: twilioToNumber,
            from: twilioFromNumber,
            body: 'Alarm triggered:' +  alarmSite
         }, function(err, message) {
            if (err) { 
               logEvent('Failed to send sms:' + err.message);
            } else {
               logEvent('SMS Sent:' + message.sid);
            }
         }); 
      }
   } else if (topic == newPictureTopic) {
      // seems like we sometimes get duplicates, avoid adding these to the picture rotation
      if ((message != picture1) &&
          (message != picture2) &&
          (message != picture3) &&
          (message != picture4)) {
         picture4 = picture3
         picture3 = picture2
         picture2 = picture1
         picture1 =  message;
      }
   }
   
   if (undefined != zoneMapping[topic]) { 
      // sensor alarm, map and publish alarm event
      client.publish(zoneMapping[topic], 'on');
      logEvent('Zone triggered - ' + zoneMapping[topic]);
      
      // if we are armed then system has been triggered
      if ('arm' == latestData[alarmStatusTopic]) { 
          client.publish(alarmStatusTopic, 'triggered');
      }
   } else {
      // other message publish directly to clients
      for (var i in clientArray) {
         clientArray[i].sendUTF(topic + ":" + message);
      }
   }
});

logEvent('Alarm active');
