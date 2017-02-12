'use strict';
/*

      UniClip! Linux Client
      Written by: Piyush Agade <piyushagade@gmail.com>


*/

//Client version
var version = 3;

//osID - (2: Windows, 3: Linux, 4: MacOS)
var osID = 3;


const debug = false;    //false
const verbose = false;   //false
const reset = false;    //false

//Electron variables
const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const storage = require('electron-json-storage');
const clipboardWatcher = require('electron-clipboard-watcher');
const Menu = electron.Menu;
const Tray = electron.Tray;
const globalShortcut = electron.globalShortcut;


//IPC variables
var ipcMain = require('electron').ipcMain;
var ipcRenderer = require('electron').ipcRenderer;

const clipboard = require('electron').clipboard;

//Firebase variables
var firebase = require('firebase');


// Initialize Firebase
var config = {
	apiKey: "AIzaSyCgzKo7TzJxiltOpD5KH4iP0HU5zp43ev0",
    authDomain: "uniclip-6004c.firebaseapp.com",
    databaseURL: "https://uniclip-6004c.firebaseio.com",
    storageBucket: "uniclip-6004c.appspot.com",
    messagingSenderId: "753305641615"
};

firebase.initializeApp(config);


var fb = firebase.database().ref().child("cloudboard");
var fb_desktops = firebase.database().ref().child("desktops");
var fb_update = firebase.database().ref().child("latest_version");



var fb_user;
var fb_data;
var r_data = "";
var link_data = "";
var stored_link_data = "";

var remote = require('electron').remote;


//Preferences variables
var authenticated = false;
var user_email;
var device_name;
var access_pin;
var autostart;
var notifications;
var automatic_sync;
var minimized;

//Preference booleans
var notificationsEnabled;
var serviceEnabled;
var startMinimizedEnabled;
var automatic_sync_enabled;
var preAuthenticated;

var winHidden = false;
var appIcon = null;

var contextMenu;

var cb_service_enabled;
var cb_automatic_sync_enabled;
var cb_start_minimized_enabled;
var cb_notifications_enabled;

if(reset){

  //reset auth preferences
  storage.set('auth', { deviceId: null, user_email: null }); 

  //set default preferences
  storage.set('pref', { autostart: true, minimized: false, notifications: true, automatic_sync: true }); 

  storage.get('auth', function(error, data) {
  	if(data.deviceId == null && data.user_email == null)console.log("*************  Reset successful *************");
  	else console.log("XXXXXXXXXXXXXXXX  Reset Failed XXXXXXXXXXXXXXXX");
  	
  });
}

app.on('ready', function(){
	var path = require('path');
  appIcon = new Tray(path.join(__dirname, 'img/ic_launcher.png'));

  //Set checkboxes from preferences
  storage.get('pref', function(error, data) {
    cb_service_enabled = data.autostart;
    cb_automatic_sync_enabled = data.automatic_sync;
    cb_start_minimized_enabled = data.minimized;
    cb_notifications_enabled = data.notifications;

    if(verbose) console.log("Tray checkboxes set to: " + cb_service_enabled + " " + cb_automatic_sync_enabled + " " + cb_start_minimized_enabled + " " + cb_notifications_enabled);

    contextMenu = Menu.buildFromTemplate([

      // //Enable/Disable Service
      // { label: 'Enable UniClip!', type: 'checkbox', checked: cb_service_enabled,
      //   click: function() { 
      //     serviceEnabled = !serviceEnabled;
      //     if(verbose) console.log("serviceEnabled toggled to: " + serviceEnabled);

      //     //get preferences from storage
      //     storage.get('pref', function(error, data) {
      //         //update preferences
      //         storage.set('pref', { autostart: serviceEnabled, minimized: data.minimized, notifications: data.notifications , automatic_sync: data.automatic_sync });  
      //     });

      //   }

      // },

      // //Enable automatic sync
      // { label: 'Automatic sync', type: 'checkbox', checked: cb_automatic_sync_enabled,
      //   click: function() {
      //     automatic_sync_enabled = !automatic_sync_enabled;
      //   if(verbose) console.log("automatic_sync_enabled toggled to: " + automatic_sync_enabled);

      //   //get preferences from storage
      //   storage.get('pref', function(error, data) {
      //       //update preferences
      //       storage.set('pref', { autostart: data.autostart, minimized: data.minimized, notifications: data.notifications , automatic_sync: automatic_sync_enabled });  
      //   });

      //   }
      // },

      // //Start minimized
      // { label: 'Start minimized', type: 'checkbox', checked: cb_start_minimized_enabled,
      //   click: function() {
      //     startMinimizedEnabled = !startMinimizedEnabled;
      //   if(verbose) console.log("startMinimizedEnabled toggled to: " + startMinimizedEnabled);

      //   //get preferences from storage
      //   storage.get('pref', function(error, data) {
      //       //update preferences
      //       storage.set('pref', { autostart: data.autostart, minimized: startMinimizedEnabled, notifications: data.notifications , automatic_sync: data.automatic_sync });  
      //   });

      //   }
      // },

      // //Enable/Disable notifications
      // { label: 'Enable notifications', type: 'checkbox', checked: cb_notifications_enabled,
      //   click: function() {
      //     notificationsEnabled = !notificationsEnabled;
      //   if(verbose) console.log("notificationsEnabled toggled to: " + notificationsEnabled);

      //   //get preferences from storage
      //   storage.get('pref', function(error, data) {
      //       //update preferences
      //       storage.set('pref', { autostart: data.autostart, minimized: data.minimized, notifications: notificationsEnabled , automatic_sync: data.automatic_sync });  
      //   });

      //   }
      // },

      { label: 'Quit',
        selector: 'terminate:',
        click: function() {

          //Reset Reauthorization value
          resetReauthorization();

          setTimeout(function() { 
           app.quit();
          }, 1000);
        }
      }
    ]);
    appIcon.setToolTip('UniClip!');
    appIcon.setContextMenu(contextMenu);
  });


  // Difference between Windows and Linux

  //Tray Icon and behaviour 
  appIcon.on('click', function handleClick () {
    if(winHidden){
      mainWindow.show();
      winHidden=false;
    }
    else{
       mainWindow.hide();
       winHidden=true;
    }
  });

  checkUpdate();

});



function checkUpdate(){
  //Notify renderer if update is available
  ipcMain.on('updateAvailable', function(event) {
    //Notify if Update available
    fb_update.on("value", function(snapshot) {
     var data = snapshot.val();
     var k = 0;

      if(parseFloat(data)>parseFloat(version) && k === 0) {
        notificationsEnabled = true;
        notify('UniClip version ' + data +' is available!', 'Please update to enjoy new features.', true);
        notificationsEnabled = false;

        event.sender.send('updateAvailable', 1); 

        k = 1;
      }
    
      }, function (errorObject) {
       console.log("The read failed: " + errorObject.code);
    
    });
  });
}


/* Single Instance Check */
var iShouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
    if (winHidden) {
       createWindow();
    }
    return true;
});

if(iShouldQuit){
  app.quit();

  return;
}

let mainWindow;

// Create window function
function createWindow () {

  var var_width = 0;
  if(debug) var_width = var_width + 600;
  var width = 500 + var_width;
  
  mainWindow = new BrowserWindow({width: width, height: 600, frame: false, 'titleBarStyle': 'hidden', resizable: false, alwaysOnTop: false, fullscreenable: false, skipTaskbar: false, kiosk: false, title: 'UniClip!', icon : __dirname + '/img/ic_launcher.png', movable: true});
  

  mainWindow.loadURL('file://' + __dirname + '/index.html');

   // Open the DevTools.
  if(debug) mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function() {
	 mainWindow = null;
  });

  //delay loading
  mainWindow.minimize();

  //Get window position from JSON
	storage.get('save_window_position', function(error, data) {
	    if(data !== null){
		    // if(data.position !== undefined) {
		    //   mainWindow.setPosition(data.position[0], data.position[1]);
		      
	        mainWindow.center();
	        
	        setTimeout(function() { 
		         mainWindow.restore();
		      }, 800);
		    }
		    else{
		      mainWindow.center();
		      mainWindow.show();
		    // }
		}
	  
	});

  // save position on hide
  mainWindow.on("hide", function() {
    var pos = mainWindow.getPosition();
    storage.set('save_window_position', { position: pos });

  });


	//Local clipboard listener
	clipboardWatcher({
	  watchDelay: 1000,
	 
	  onImageChange: function (nativeImage) { 
	      // Do something with image
	  },
	  onTextChange: function (text) { 
	      // Do something with text
	      if(verbose) console.log("Local clipboard changed.");

	      if(authenticated && serviceEnabled && automatic_sync_enabled) {
	        var data = clipboard.readText('text');
	        data = encrypt(encrypt(encrypt(data)));

	        var fb_user = fb.child(encrypt(encrypt(encrypt(user_email))));
	        fb_user.update({'data': data});
	      }
	  }
	});

}



app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();

    var pos = mainWindow.getPosition();
    storage.set('save_window_position', { position: pos });
  }
  winHidden = true;
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});



//Shortkeys and Clipboard management
app.on('ready', function() {

	//Ctrl + Shift + C
	var ret_accept = globalShortcut.register('ctrl+shift+c', function() {
		var data = clipboard.readText('text');
		data = encrypt(encrypt(encrypt(data)));

		if(authenticated && serviceEnabled) {
		    var fb_user = fb.child(encrypt(encrypt(encrypt(user_email))));
		    fb_user.update({'data': data});
		}
	});

	//Ctrl + Shift + V
	var ret_send = globalShortcut.register('ctrl+shift+v', function() {
	    if(authenticated && serviceEnabled) {
	      clipboard.writeText(decrypt(decrypt(decrypt(r_data))));  
	    }
	    
	});

	//Ctrl + Shift + O
	var ret_send = globalShortcut.register('ctrl+shift+o', function() {
	    if(authenticated && serviceEnabled) {
	       if(stored_link_data !== 'empty_link') {
	            if(stored_link_data !== null) {
	              require('child_process').exec('xdg-open ' + link_data.split("%")[0]);
	            }
	        }  
	    }
	});


  //Difference in Windows and Linux code

	//Ctrl + Shift + U
	var ret_btf = globalShortcut.register('ctrl+shift+u', function() {
	    if(winHidden) {
	        mainWindow.show();
	        winHidden=false;

	    	//Set Reauthorization value
	    	if(!preAuthenticated) notifyForAuthorization();
	    }
	    else{
	        if(mainWindow != null) mainWindow.hide();
	        notify("UniClip running in background","Press Ctrl+shift+U to show it again.", true)
	        winHidden=true;


	      	//Delete device from desktops
	      	if(!authenticated){
	        	var fb_delete = fb_desktops.child(device_name);
	        	fb_delete.remove();
	      	}

	     	//Reset Reauthorization value
	     	resetReauthorization();

	    }
	});
  
	//Ctrl + Shift + Q
	ipcMain.on('quit', function(event) {
	    var ret_quit = globalShortcut.register('ctrl+shift+q', function() {
		    if(verbose) console.log('Quiting');

		    //Hide window
		    if(!winHidden){
           winHidden = true;
		       mainWindow.hide();
		    }

		    //Reset Reauthorization value
		    resetReauthorization();

		    try{
		      event.sender.send('quit', 1);       
		    }
		    catch(e){
		      //Do nothing
		    }
		 
		    //Announce that user is not currently using the desktop client
        if(user_email != null){
            fb_user = fb.child(encrypt(encrypt(encrypt(user_email))));
            fb_user.child("used_desktop_client").set("false");
        }

        setTimeout(function() { 
          app.quit();
        }, 3000);
		    
		});

		if (!ret_accept) {
		    console.log('Cannot register keyboard shortcuts. The combinations might be already registerd by some other app.');
		}
	});

	  //Ctrl + Shift + Alt + U
  	var ret_accept = globalShortcut.register('ctrl+shift+alt+u', function() {
  	    automatic_sync_enabled = !automatic_sync_enabled;
  	    console.log("automatic_sync_enabled toggled to: " + automatic_sync_enabled);

    		//get preferences from storage
    		storage.get('pref', function(error, data) {
    		    //update preferences
    	    	storage.set('pref', { autostart: data.autostart, minimized: data.minimized, notifications: data.notifications , automatic_sync: automatic_sync_enabled });  
    		});
  	});
});


//Behave according to preferences
app.on('ready', function() {


  //get preferences
  storage.get('pref', function(error, data) {
    
    //if first run (pref not set before)
    if(data.autostart == null && data.minimized == null && data.notifications == null && data.automatic_sync == null){
      //set default preferences
      storage.set('pref', { autostart: true, minimized: false, notifications: true, automatic_sync: true }); 
    } 

    // If not first run
    else{
      if(data.autostart == true){
          serviceEnabled = true;
      }
      else{
          serviceEnabled = false;
          notify('UniClip service is paused', 'Enable service in Preferences.', true);
      }



      if(data.notifications == true){
          notificationsEnabled = true;
      }
      else{
          notificationsEnabled = false;
      }

      // Difference in windows and linux code
      if(data.minimized == true){
        createWindow();
        setTimeout(function() { 
          mainWindow.hide();
          winHidden = true;
        }, 1400);

        // if(!authenticated) notify('Re-authorization needed', 'Hit Ctrl + Shift + U to open UniClip.');
      }
      else{
        createWindow();
        winHidden = false;
      }


      if(data.automatic_sync == true){
          automatic_sync_enabled = true;
      }
      else{
          automatic_sync_enabled = false;
      }

    }
  });

});


// Notify
function notify(title, desc, override){
  if(notificationsEnabled || override){
    var path = require('path');
    const notifier = require('node-notifier');

    notifier.notify({
      title: title,
      message: desc,
      icon: path.join('__dirname', '/img/ic_launcher.png'), 
      sound: true,
      wait: true
    }, function (err, response) {
      //Do nothing
    });

      
  }
}


//On intention to quit
app.on('will-quit', function() {
  // Unregister a shortcut.
  globalShortcut.unregister('ctrl+shift+c');
  globalShortcut.unregister('ctrl+shift+v');
  globalShortcut.unregister('ctrl+shift+u');
  globalShortcut.unregister('ctrl+shift+q');
  globalShortcut.unregister('ctrl+shift+o');
  globalShortcut.unregister('ctrl+shift+alt+u');

  // Unregister all shortcuts.
  globalShortcut.unregisterAll();


  // Save window position.
  if(mainWindow!=null){
      var pos = mainWindow.getPosition();
      storage.set('save_window_position', { position: pos });
  }

});



//Global Objects
global.sharedObj = {user_email: null, device_name: null, access_pin: null};
global.authentication_status = {authenticated: null};
global.prefObj = {autostart: null, minimized: null, notifications: null, automatic_sync: null};
global.deviceName = {device_name: null};


var k=0;
ipcMain.on('validate', function(event) {
  user_email = decrypt(decrypt(decrypt(global.sharedObj.user_email)));
  device_name = global.sharedObj.device_name;
  access_pin = global.sharedObj.access_pin;

  
  fb_user = fb.child(encrypt(encrypt(encrypt(user_email))));
  fb_data = fb_user.child("data");
  
  var fb_pin;
  var snapshot;

  //Check if username exists
  var this_user = fb.child(encrypt(encrypt(encrypt(user_email))));
  var key_node = this_user.child('key');
  var link = this_user.child('link');

  //Get access pin
  key_node.on("value", function(snapshot) {
    fb_pin = snapshot.val();
      if(fb_pin!==("")){
        if(k==1 && verbose) console.log('authentication attempted twice.');
        
        if(k==0){
          event.sender.send('validate', 2); //authenticated
          if(verbose) console.log('Verified');
          onVerified();
        }
        k=1;
      }
      else if(!(fb_pin===(access_pin))) {
        event.sender.send('validate', 1); //wrong pin
        if(verbose) console.log('Not Authorized');
      }
  
  });
  

});





function notifyForAuthorization(){
  //Get device ID
 storage.get('auth', function(error, data) {

  try {
    //Set reauth request
    if(data.user_email !== null && !authenticated) {
      var fb_user = fb.child(encrypt(encrypt(encrypt(data.user_email))));
      var fb_reauthorization = fb_user.child("reauthorization");
      fb_reauthorization.set(1);
    }

  }catch(e){
    // Do Nothing
  }
      
 });

}

function resetReauthorization(){

  //Get device ID
 storage.get('auth', function(error, data) {

  //Desktop removes from devices after application closes

  try {
    if(data.user_email !== null && data.user_email !== '' && data.user_email !== undefined) {
      var fb_user = fb.child(encrypt(encrypt(encrypt(data.user_email))));
      var fb_reauthorization = fb_user.child("reauthorization");
      fb_reauthorization.set(0);
    }

  }catch(e){
    // Do Nothing
  }
 });
}



//Preauthentications and Reauthentications
app.on('ready', function(){

  storage.get('auth', function(error, data) {
  try {
    if(data.deviceId !== null && data.deviceId !== "" && data.deviceId !== undefined) {
      if(verbose) console.log("Preauthenticate successful.");

      //Preauthenticate
      authenticated = true;
      preAuthenticated = true
      user_email = data.user_email;
      device_name = data.deviceId;

      var fb_user = fb.child(encrypt(encrypt(encrypt(data.user_email))));

      onVerified();

    }
    //Set reauth request, Reauthorization required
    else{
      try {
        if(verbose) console.log("Previous User: "+data.user_email);

        var fb_user = fb.child(encrypt(encrypt(encrypt(data.user_email))));
        var fb_reauthorization = fb_user.child("reauthorization");
      
        //If window is hidden, bring to front
        fb_reauthorization.on("value", function(snapshot) {
         var reauth_value = snapshot.val();
         if(reauth_value === "2" && (mainWindow.isMinimized() || winHidden)){
           mainWindow.restore();
           mainWindow.show();
           winHidden=false;
          }
    
       });

        notifyForAuthorization();
      }catch(e){

      }
    }

  }catch(e){
    // Do Nothing
  }
      
 });


});


function onVerified() {

  authenticated = true;
  if(verbose) console.log("Device verified: "+device_name);
  if(verbose) console.log("User: "+user_email);

  //Persist device ID
  if(!preAuthenticated)
   storage.set('auth', { deviceId: device_name, user_email: user_email }, function(error) {
   if(verbose) console.log('User info stored for reauthorization: '+device_name+", "+user_email);

    if (error)
     throw error;
  });  

  var fb_user = fb.child(encrypt(encrypt(encrypt(user_email))));
  var fb_devices = fb_user.child('devices');
  var fb_device = fb_devices.child(device_name);

  //Set desktop client version on cloud
  if(preAuthenticated) fb_device.set(3+'%'+version);

  //Desktop removed from devices after application closes
  var fb_user = fb.child(encrypt(encrypt(encrypt(user_email))));
  var fb_data = fb_user.child("data");
  var fb_link = fb_user.child("link");
  var fb_devices = fb_user.child("devices");
  var fb_device = fb_devices.child(device_name);

  fb_device.onDisconnect().remove();


  //Announce that user is using the desktop client
  setTimeout(function() { 
    fb_user.child("used_desktop_client").set("true");
  }, 1000);

  //Cloudboard Listener  
  fb_data.on("value", function(snapshot) {
        r_data = snapshot.val();

        if(verbose) console.log("Incoming data: "+r_data);

        var notification_body = 'Press Ctrl + Shift + V to update your clipboard.';
        if(automatic_sync_enabled)  notification_body = 'Clipboard updated.';
        if(serviceEnabled && clipboard.readText('text') !== decrypt(decrypt(decrypt(r_data)))) notify('Incoming clip!', notification_body, false);

        }, function (errorObject) {
  });

  //Link Listener  
  fb_link.on("value", function(snapshot) {
        link_data = snapshot.val();
        if(link_data !== 'empty_link') stored_link_data = link_data;

        if(verbose && link_data !== null) console.log("Incoming link data: "+link_data.split("%")[0]);

        if(serviceEnabled){
          if(link_data !== 'empty_link') {
            if(link_data !== null) {
              require('child_process').exec('xdg-open ' + link_data.split("%")[0]);
              fb_link.set("empty_link");
            }
          }
        }

        }, function (errorObject) {
  });
}



ipcMain.on('auth_status', function(event) {
  if(verbose) console.log('Auth status requested by renderer.');


      //Get device ID
      storage.get('auth', function(error, data) {
      });

      if (authenticated || preAuthenticated){
        event.sender.send('auth_status', 2);  // already authenticated from minimized
        if(verbose) console.log('Already authenticated.');

      } 
      else{
        event.sender.send('auth_status', 1);  // authentication required
        if(verbose) console.log('Not authenticated.');
      }
        
});


// Logout
ipcMain.on('logout', function(event) {

  if(verbose) console.log("Logged out");

  //Remove deviceId as persistent
  storage.set('auth', { deviceId: '', user_email: user_email }, function(error) {
  
  
  if (error)
     throw error;
  });  


  event.sender.send('logout', 1); 

  setTimeout(function() { 
    app.quit();
  }, 4000);

});


// Renderer set preferences
ipcMain.on('setPreferences', function(event) {

    autostart = global.prefObj.autostart;
    minimized = global.prefObj.minimized;
    notifications = global.prefObj.notifications;
    automatic_sync = global.prefObj.automatic_sync;

    //Set tray menu checkboxes
    // contextMenu.items[1].checked = autostart
    // contextMenu.items[2].checked = automatic_sync
    // contextMenu.items[3].checked = minimized
    // contextMenu.items[4].checked = notifications

    if(verbose) console.log("Preferences & tray menu updated: "+autostart+", "+minimized+", "+notifications+", "+ automatic_sync);

    //Enable service if appropiate
    if(autostart == true) serviceEnabled = true;
    else serviceEnabled = false;
    
    //Enable notifications if appropiate
    if(notifications == true) notificationsEnabled = true;
    else notificationsEnabled = false;

    //Enable auto_sync if appropiate
    if(automatic_sync == true) automatic_sync_enabled = true;
    else automatic_sync_enabled = false;

    //update preferences
    storage.set('pref', { autostart: autostart, minimized: minimized, notifications: notifications, automatic_sync: automatic_sync });  

    event.sender.send('setPreferences', 1);

});

//Renderer request for preferences
ipcMain.on('getPreferences', function(event) {

  if(verbose) console.log("Preferences requested.");


  //get preferences from storage
	storage.get('pref', function(error, data) {
	    //if first run
	    if(data.autostart == null && data.minimized == null && data.notifications == null && data.automatic_sync == null){
		    //set default preferences
		    storage.set('pref', { autostart: true, minimized: false, notifications: true , automatic_sync: true }); 

		    event.sender.send('getPreferences', [true, false, true, true]); 

		    if(verbose) console.log("Default preferences sent.");
	    } 
	    else{
	        event.sender.send('getPreferences', [data.autostart, data.minimized, data.notifications, data.automatic_sync]); 
	        if(verbose) console.log("Preferences sent: "+data.autostart+", "+data.minimized+", "+data.notifications+", " + data.automatic_sync);
	    }
	});


});

//Set device name on makeId()
ipcMain.on('sendDeviceName', function(event) {
  device_name = global.deviceName.device_name;

  if(verbose) console.log("Device name generated: "+device_name);
});

//Hide window from Renderer processes
ipcMain.on('closeWindow', function(event) {
  if(verbose) console.log("Renderer requested to hide to tray.");
  notify("UniClip running in background","Press Ctrl+shift+U to show it again.", true)
  mainWindow.hide();
  winHidden = true;
});




//Encrypt function
function encrypt(data) {
	if(data !== null){
        var k = data.length;
        var m = Math.floor((k + 1)/2);

        var raw = data.split('');
        var temp = new Array();

        for(var j = 0; j < k; j++){
            if(j >= 0 && j < m){
                temp[2*j] = raw[j];
            }
            else if(j >= m  && j <= k - 1){
                if(k % 2 == 0) temp[2*j - k + 1] = raw[j];
                else temp[2*j - k] = raw[j];
            }
        }

        return temp.join("");
    }

}

//Decrypt function
function decrypt(data){
    if(data != null){
        var k = data.length;
        var m = Math.floor((k + 1)/2);


        var raw = data.split("");
        var temp = new Array();

        for(var j = 0; j < k; j++){
            if(j >= 0 && j < m){
                temp[j] = raw[2*j];
            }
            else if(j >= m  && j <= k - 1){
                if(k % 2 == 0) temp[j] = raw[2*j - k + 1];
                else temp[j] = raw[2*j - k];
            }

        }
        return temp.join("");
      }
      return ""
}


/*






		Linux client for UniClip! created by Piyush Agade
		www.piyushagade.xyz







*/