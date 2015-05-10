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

![picture of alarm main window](https://github.com/mhdawson/HomeAlarm/blob/master/pictures/alarm_main_window.jpg?raw=true)

The following projects can be used to connect sensors such
motion detectors, door contacts and webcams.
* [PI433WirelessRecvMananager](https://github.com/mhdawson/PI433WirelessRecvManager)
* [PIWebcamServer](https://github.com/mhdawson/PIWebcamServer)

Additional views when alarm is active and triggered

![picture of alarm when armed](pictures/alarm_main_window_armed.jpg?raw=true)
![picture of alarm when triggered](pictures/alarm_main_window_triggered.jpg?raw=true)

## TODOs
- Add more doc on how to configure, setup and run, including the required mqtt server
- Generate page.html from a template so that URL from which to get pictures and be configured in config.txt
- Modify to be able to connect to mqtt server using ssl
- Add support for turning on IR illuminator before taking picture
- Add support for day/night sensor 
- Add support for multiple webcams, selectable based on day/night
- Mobile app for gui would be nice. 

