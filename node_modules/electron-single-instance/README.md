# Electron Single Instance

Simple module to help apps developed using [Electron] (http://electron.atom.io/) from opening multiple instances. This is particularly an issue on Windows.

## Usage

From your application:
- var ESI = require('electron-single-instance');
- ESI.ensureSingleInstance('application name', mainWindow); //mainWindow is optional
- If your application is not running, it will be launched.
- If your application is already running, your mainWindow will be focused.