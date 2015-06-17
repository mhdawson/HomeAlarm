# MQTT/Node base home alarm system

This projects provides a home based alarm system using Node and
MQTT. It provides a GUI that allows you to:

* arm/disarm the alarm
* see the status of the zones
* ask that a picture be taken
* view the last 4 pictures taken
* view the log of alarm events

When the alarm is triggered it will take pictures every 10 second for 5 minutes, pushing them to a remote webserver.
It can also be configured to send sms messages to notify the owner than an alarm has occured

![picture of alarm main window](pictures/alarm_main_window.jpg?raw=true)

The following projects can be used to connect sensors such
motion detectors, door contacts and webcams.
* [PI433WirelessRecvMananager](https://github.com/mhdawson/PI433WirelessRecvManager)
* [PIWebcamServer](https://github.com/mhdawson/PIWebcamServer)

Additional views when alarm is active and triggered

![picture of alarm when armed](pictures/alarm_main_window_armed.jpg?raw=true)
![picture of alarm when triggered](pictures/alarm_main_window_triggered.jpg?raw=true)

View when using GUI to display pictures taken by camera
![sample camera picture view](pictures/alarm_camera_pictures_view.jpg?raw=true)

The server requires Node with the following modules installed:

* basic-auth
* mqtt
* twilio
* websocket
 
It also requires:

* an mqtt server 
* a remote webserver to serve up the pictures taken
* twillio account (If you want SMS notifications)

Most configuration is done in the config.txt file which supports the following configuration options:

* alarmSite=\<Name assigned to this instance of the alarm\>
* username=\<username that must be provided to acess the alarm\>
* password=\<password that must be provided to acess the alarm\>
* port=\<port on which alarm GUI is server\>
* mqttServerIP=\<IP of mqtt server\>
* mqttRootTopic=\<root topic under which events are pubished/subscribed\>
* zone=\<topic for sensor\>:\<zone\>:\<named assigned to zone\>   (one or more of these)
* twilioAccountSID=\<twillio account for SMS notifications\>
* twilioAccountAuthToken=\<authentication token for twillio account\>
* twilioFromNumber=\<twillio from number\>
* twilioToNumber=\<twillio to number\>
* cameraTopic=\<topic to which to publish requests that a picture be taken\>
* eventLogPrefix=\<directory in which log for alarm will be written\>

## TODOs
- Add more doc on how to configure, setup and run, including the required mqtt server
- Generate page.html from a template so that URL from which to get pictures and be configured in config.txt
- Modify to be able to connect to mqtt server using ssl
- Add support for turning on IR illuminator before taking picture
- Add support for day/night sensor 
- Add support for multiple webcams, selectable based on day/night
- Mobile app for gui would be nice. 

