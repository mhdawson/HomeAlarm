#!/bin/bash
export PATH=/home/node/currentNode/bin:$PATH
cd /home/node/HomeAlarm
node server.js ./config.txt
