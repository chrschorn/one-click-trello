@echo off
setlocal

del OneClickSendToTrello.zip && powershell -Command "& Compress-Archive -Path src/* -DestinationPath OneClickSendToTrello.zip"