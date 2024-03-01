/**
 * The websocket protocol with the INTEG JNIOR Series 4
 */
function JnrWebsocket() {
    var _service = this;
    var _comm = new Comm();



    function getHash() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16).substring(1);
    }



    /**
     * Add Event Listeners
     */
    _service.addEventListener = function (event, callback) {
        if ('onLoggedIn'.toLowerCase() === event.toLowerCase()) _service.addOnLoggedInListener(callback);
        else if ('onMessage'.toLowerCase() === event.toLowerCase()) _service.addOnMessageListener(callback);
        else if ('onReplyMessage'.toLowerCase() === event.toLowerCase()) _service.addOnReplyMessageListener(callback);
    };

    function alertListeners(listeners, json) {
        listeners.forEach(function (listener) {
            if (null == json) listener();
            else listener(json);
        });
    }



    // Connects to a given uri.  if the uri is not given then it is constructed from 
    // the window.host
    _service.connect = function (uri) {
        if (uri) _comm.wsUri = uri;
        _comm.onopen = _service.onOpened;
        _comm.onclose = function () {
            _loggedIn = false;
            if (_service.onClosed)
                _service.onClosed();
        };
        _comm.onerror = _service.onError;
        _comm.onmessage = onmessage;
        _comm.connect();
    };


    // Helper function to get the wsuri from our com object
    _service.getWsUri = function () {
        return _comm.wsUri;
    };

    // Helper function to call close on our comm object
    _service.close = function () {
        _comm.close();
    }

    // Helper function to call the enable comm logging on the comm object
    _service.enableCommLogging = function () {
        _comm.enableCommLogging = true;
    };

    // Helper function to assign the authentication needed callback
    _service.setAuthenticationNeededCallback = function (callback) {
        _comm.onauth = callback;
    };

    _service.setCredentials = function (username, password) {
        _comm.username = username;
        _comm.password = password;
    };

    // Helper function to call sendJson on our comm object
    _service.sendJson = function (jsonMessage) {
        _comm.sendJson(jsonMessage);
    }



    /**
     * On Websocket Open
     */
    _service.onOpened = function () {};



    /**
     * On Websocket Close
     */
    _service.onClosed = function () {};



    /**
     * On WebSocket Error
     */
    _service.onError = function () {};



    /**
     * Add a message listener
     */
    var _onMessageListeners = [];

    _service.addOnMessageListener = function (callback) {
        _onMessageListeners.push(callback);
    };



    /**
     * Add a monitor packet listener
     */
    var _onMonitorListeners = [];

    _service.addOnMonitorListener = function (callback) {
        _onMonitorListeners.push(callback);
    };



    /**
     * Called whenever a message is received from the JNIOR WebSocket connection
     */
    var onmessage = function (evt) {
        var json = JSON.parse(evt.data);
        // if (this.enableCommLogging) console.log(_comm.wsUri + ' ' + JSON.stringify(json));

        try {
            alertListeners(_onMessageListeners, json);
        } catch (err) {}

        // Monitor
        if (json.Message === "Monitor") {
            // We will only get the monitor message when we are logged in.  So alert the on
            // logged listeners if this is the first message received
            if (!_loggedIn) {
                _loggedIn = true;
                if (_service.onLoggedIn) _service.onLoggedIn();
                alertListeners(_onLoggedInListeners, json);
            }
            alertListeners(_onMonitorListeners, json);
        }

        // Registry
        else if (json.Message === "Registry Response") registryResponse(json);
        else if (json.Message === "Registry Update") registryUpdate(json);
        else if (json.Message === "Registry List Response") registryListResponse(json);

        // File System
        else if (json.Message === "File List Response") fileListResponse(json);
        else if (json.Message === "File Read Response") fileReadResponse(json);
        else if (json.Message === "File Write Response") fileWriteResponse(json);
        else if (json.Message === "File Rename Response") fileRenameResponse(json);
        else if (json.Message === "File Remove Response") fileRemoveResponse(json);
        else if (json.Message === "File Mkdir Response") fileMkdirResponse(json);

        // External Devices
        else if (json.Message === "Read Devices Response") readDevicesResponse(json);

        // Custom Application Communication
        else if (json.Message === "Reply Message") replyMessage(json);

        // else, if we havent handled it then Alert our onMessageListeners
        else {
            try {
                var contentJson = JSON.parse(json.Content);
                alertListeners(_onMessageListeners, contentJson);
            } catch (err) {}
        }
    };



    /**
     * Login Functionality
     */
    var _loggedIn = false;

    _service.onLoggedIn = null;
    var _onLoggedInListeners = [];

    _service.authenticate = function (username, password) {
        _comm.authenticate(username, password);
    };

    // Used to add a listener to the logged in listeners collection
    _service.addOnLoggedInListener = function (callback) {
        // if we are currently logged in then we will call the callback immediately.  This
        // catches the case where the addonloggedinlistener is called late in the page 
        // loading lifecycle
        if (_loggedIn) callback();
        else _onLoggedInListeners.push(callback);
    };

    // Used to see if the websocket connection has already been authenticated
    _service.isAuthenticated = _service.isLoggedIn;
    _service.isLoggedIn = function () {
        return _loggedIn;
    };


    /**
     * Output Functionality
     */
    _service.toggleOutput = function (channel) {
        var jsonRequest = {
            "Message": "Control",
            "Command": "Toggle",
            "Channel": channel
        };
        _comm.sendJson(jsonRequest);
    };


    _service.closeOutput = function (channel, duration) {
        var jsonRequest = {
            "Message": "Control",
            "Command": "Close",
            "Channel": channel
        };
        if (duration) jsonRequest.Duration = duration;
        _comm.sendJson(jsonRequest);
    };


    _service.openOutput = function (channel, duration) {
        var jsonRequest = {
            "Message": "Control",
            "Command": "Open",
            "Channel": channel
        };
        if (duration) jsonRequest.Duration = duration;
        _comm.sendJson(jsonRequest);
    };


    /**
     * Registry Functionality
     */
    var _registryReadCallbacks = [];
    var _registrySubscriptionCallbacks = [];
    var _registryWriteCallbacks = [];
    var _registryListingCallbacks = [];


    _service.readRegistryKeyAsync = async function (keyname) {
        let promise = new Promise((resolve, reject) => {
            _service.readRegistryKey(keyname, function (keyname, value) {
                resolve(value);
            });
        });

        return await promise;
    }


    // Used to read a single key from the registry.  This function does not return a value
    // but rather the provided callback will be called when the value is returned.
    _service.readRegistryKey = function (key, callback) {
        // warn the user if a callback was not provided
        if (!callback) throw ("callback was not provided to readRegistryKey()");
        if (null == callback) throw ("callback provided to readRegistryKey() was null");
        if (!(callback instanceof Function)) throw ("callback provided to readRegistryKey() is not a function");

        if (!_registryReadCallbacks[key] || null == _registryReadCallbacks[key]) {
            _registryReadCallbacks[key] = [];
        }
        var index = _registryReadCallbacks[key].indexOf(callback);
        if (-1 === index) {
            _registryReadCallbacks[key].push(callback);
        }

        var jsonRequest = {
            "Message": "Registry Read",
            "Keys": [key]
        };
        _comm.sendJson(jsonRequest);
    };


    // Used to read multiple keys from the registry.  This function does not return a value
    // but rather the provided callback will be called when the value is returned.
    _service.readRegistryKeys = function (keys, callback) {
        // warn the user if a callback was not provided
        if (!callback) throw ("callback was not provided to readRegistryKeys()");
        if (null == callback) throw ("callback provided to readRegistryKeys() was null");
        if (!(callback instanceof Function)) throw ("callback provided to readRegistryKeys() is not a function");

        var metaHash = 'reg.read-' + getHash();
        _registryReadCallbacks[metaHash] = callback;

        var jsonRequest = {
            "Message": "Registry Read",
            "Keys": keys,
            Meta: {
                Hash: metaHash
            }
        };
        _comm.sendJson(jsonRequest);
    };


    // Used to read a single key from the registry.  This function does not return a value
    // but rather the provided callback will be called when the value is returned.  This is
    // the same as the readRegistryKey except that the callback is added to a different collection
    // that gets called whenever a registry update is provided for the given key.
    _service.registrySubscription = _service.subscribeRegistryKey = function (key, callback) {
        // warn the user if a callback was not provided
        if (!callback) throw ("callback was not provided to registrySubscription()");
        if (null == callback) throw ("callback provided to registrySubscription() was null");
        if (!(callback instanceof Function)) throw ("callback provided to registrySubscription() is not a function");

        var metaHash = 'reg.subscription-' + getHash();
        _registrySubscriptionCallbacks[metaHash] = callback;

        // now we save our callback by the key name so we can call this callback any time 
        // that the key is updated
        _registrySubscriptionCallbacks[key.toLowerCase()] = callback;

        var jsonRequest = {
            "Message": "Registry Read",
            "Keys": [key],
            Meta: {
                Hash: metaHash,
                Key: key
            }
        };
        _comm.sendJson(jsonRequest);
    };


    // Called when a registry key is requested
    function registryResponse(json) {

        var callbacks = _registryReadCallbacks;
        if (json.Meta && json.Meta.Hash) {
            if (json.Meta.Hash.startsWith("reg.write")) {
                callbacks = _registryWriteCallbacks;
            } else if (json.Meta.Hash.startsWith("reg.subscription")) {
                callbacks = _registrySubscriptionCallbacks;
            }
        }

        if (callbacks) {
            // is a meta object defined?
            if (json.Meta && json.Meta.Hash) {
                var callback = callbacks[json.Meta.Hash];
                if (callback && null !== callback) {
                    if (Array.isArray(callback)) {
                        var newKeys = {};
                        for (var key in json.Keys) {
                            newKeys[key.toLowerCase()] = json.Keys[key];
                        };
                        callback(newKeys);
                    } else {
                        var newKeys = {};
                        for (var key in json.Keys) {
                            newKeys[key.toLowerCase()] = json.Keys[key];
                        };
                        if (json.Meta.Hash.startsWith("reg.write") || json.Meta.Hash.startsWith("reg.subscription")) {
                            var key = json.Meta.Key;
                            var value = json.Keys[key];
                            callback(key.toLowerCase(), value);
                        } else {
                            callback(newKeys);
                        }
                    }
                }
            } else {
                for (var key in json.Keys) {
                    if (json.Keys.hasOwnProperty(key)) {
                        var value = json.Keys[key];

                        var callback = _registryReadCallbacks[key];
                        if (callback && null !== callback) {
                            if (Array.isArray(callback)) {
                                callback.forEach(function (cb) {
                                    cb(key.toLowerCase(), value);
                                });
                            } else {
                                callback(key.toLowerCase(), value);
                            }
                        }

                        var callback = _registrySubscriptionCallbacks[key];
                        if (callback && null !== callback) {
                            if (Array.isArray(callback)) {
                                callback.forEach(function (cb) {
                                    cb(key.toLowerCase(), value);
                                });
                            } else {
                                callback(key.toLowerCase(), value);
                            }
                        }
                    }
                }
            }
        }
    }


    // Called when a registry key changes
    function registryUpdate(json) {
        for (var key in json.Keys) {
            if (json.Keys.hasOwnProperty(key)) {
                var value = json.Keys[key];
                var callback = _registryWriteCallbacks[key.toLowerCase()];
                if (callback && null !== callback) callback(key, value);
                callback = _registrySubscriptionCallbacks[key.toLowerCase()];
                if (callback && null !== callback) callback(key, value);
            }
        }
    }


    // Used to write a registry key
    _service.registryWrite = _service.writeRegistryKey = function (key, value, callback) {
        var metaHash = 'reg.write-' + getHash();
        _registryWriteCallbacks[metaHash] = callback;

        var jsonRequest = {
            "Message": "Registry Write",
            "Keys": {},
            "Meta": {
                Hash: metaHash,
                Key: key
            }
        };
        jsonRequest.Keys[key] = value.toString();
        _comm.sendJson(jsonRequest);
    };


    // Used to the registry listing for a registry directory
    _service.getRegistryListing = function (folderName, callback) {
        // warn the user if a callback was not provided
        if (!callback) throw ("callback was not provided to readFile()");
        if (null == callback) throw ("callback provided to readFile() was null");
        if (!(callback instanceof Function)) throw ("callback provided to readFile() is not a function");

        _registryListingCallbacks[folderName] = callback;
        var jsonRequest = {
            Message: "Registry List",
            "Meta": {
                "Op": "registry",
                "Node": folderName
            },
            "Node": folderName
        };
        _comm.sendJson(jsonRequest);
    };


    // Called when a registry listing is requested
    function registryListResponse(json) {
        var folderName = json.Meta.Node;
        var callback = _registryListingCallbacks[folderName];
        if (null !== callback) {
            callback(folderName, json.Keys);
        }
    }



    /**
     * File System
     */
    var _fileListCallbacks = [];
    var _readFileCallbacks = [];
    var _writeFileCallbacks = [];
    var _mkDirCallbacks = [];
    var _renameFileCallbacks = [];
    var _removeFileCallbacks = [];


    /*
     * Used to get a file listing from the filesystem.  this method adds a supplied callback to 
     * the callback array and is called when the file listing response is returned
     */
    _service.getFileListingAsync = async function (folder) {
        let promise = new Promise((resolve, reject) => {
            _service.getFileListing(folder, function (folderContentArray) {
                folderContentArray.forEach(function (item) {
                    item.Folder = folder;
                    if (!item.Folder.endsWith('/')) item.Folder += '/';
                });
                resolve(folderContentArray);
            });
        });
        return await promise;
    };


    /*
     * Used to get a file listing from the filesystem.  this method adds a supplied callback to 
     * the callback array and is called when the file listing response is returned
     */
    _service.getFileListing = function (folder, callback) {
        // warn the user if a callback was not provided
        if (!callback) throw ("callback was not provided to getFileListing()");
        if (null == callback) throw ("callback provided to getFileListing() was null");
        if (!(callback instanceof Function)) throw ("callback provided to getFileListing() is not a function");

        var metaHash = 'file.listing-' + getHash();
        _fileListCallbacks[metaHash] = callback;
        var jsonRequest = {
            Message: "File List",
            Folder: folder,
            Meta: {
                Hash: metaHash
            }
        };
        _comm.sendJson(jsonRequest);
    };


    /*
     * Called when the jnior responds to a getfilelisting request
     */
    function fileListResponse(fileListingJson) {
        if (fileListingJson.Status === "Fail") {} else {
            if (fileListingJson.Meta && fileListingJson.Meta.Hash) {
                var callback = _fileListCallbacks[fileListingJson.Meta.Hash];

                // if there was a callback defined for this folder then we shall call it now
                if (callback) {
                    var folderContentArray = fileListingJson.Content;
                    callback(folderContentArray);
                }
            }
        }
    }


    _service.readFileAsync = async function (filename) {
        let promise = new Promise((resolve, reject) => {
            _service.readFile(filename, function (result) {
                // the callback indicates that the workspace file has been read
                if ('Fail' !== result.Status) {
                    // var fileContents = Base64.decode(result.Data);
                    var fileContents = atob(result.Data);
                    fileContents = unescapeUnicode(fileContents);
                    resolve(fileContents);
                } else {
                    resolve(null);
                    // reject();
                }
            });
        });

        return await promise;
    }


    // Used to read a file from the filesystem
    _service.readFile = function (filename, callback) {
        // warn the user if a callback was not provided
        if (!callback) throw ("callback was not provided to readFile()");
        if (null == callback) throw ("callback provided to readFile() was null");
        if (!(callback instanceof Function)) throw ("callback provided to readFile() is not a function");

        if (!filename.startsWith('/')) {
            filename = '/' + filename;
        }
        _readFileCallbacks[filename] = callback;

        var metaHash = 'file.read-' + getHash();
        _readFileCallbacks[metaHash] = callback;
        var jsonRequest = {
            Message: "File Read",
            File: filename,
            Meta: {
                Hash: metaHash
            }
        };
        _comm.sendJson(jsonRequest);
    };


    // Called in response to trying to read a file
    function fileReadResponse(json) {
        var file = json.File;
        var callbackIndex = file;
        if (json.Meta && json.Meta.Hash) callbackIndex = json.Meta.Hash;

        var callback = _readFileCallbacks[callbackIndex];
        if (callback) {
            callback(json);
        }
    }


    _service.writeFileAsync = async function (filename, content) {
        let promise = new Promise((resolve, reject) => {
            _service.fileWrite(filename, content, function (result) {
                // the callback indicates that the workspace file has been read
                if ('Fail' !== result.Status) {
                    resolve(true);
                } else {
                    resolve(false);
                    // reject();
                }
            });
        });

        return await promise;
    };


    // Used to write a file to the jnior
    _service.writeFile = _service.fileWrite = function (filename, content, callback) {
        if (!filename.startsWith('/')) {
            filename = '/' + filename;
        }
        const utf16Escaped = escapeUnicode(content);
        console.log("\r\n" + utf16Escaped);
        var fileData = Base64.encode(utf16Escaped);
        console.log("\r\n" + fileData);

        var metaHash = 'file.write-' + getHash();
        _writeFileCallbacks[metaHash] = callback;
        var jsonRequest = {
            Message: "File Write",
            File: filename,
            Size: utf16Escaped.length,
            Encoding: "base64",
            Data: fileData,
            Meta: {
                Hash: metaHash
            }
        };
        _comm.sendJson(jsonRequest);
    };



    // Called in response to trying to write a file
    function fileWriteResponse(json) {
        var file = json.File;
        var callbackIndex = file;
        if (json.Meta && json.Meta.Hash) callbackIndex = json.Meta.Hash;

        var callback = _writeFileCallbacks[callbackIndex];
        if (callback) {
            callback(json);
        }
    }


    // Used to rename a file in the filesystem
    _service.renameFileAsync = async function (oldFilename, newFilename) {
        let promise = new Promise((resolve, reject) => {
            _service.renameFile(oldFilename, newFilename, function (result) {
                // the callback indicates that the workspace file has been read
                resolve(result);
            });
        });

        return await promise;
    };


    // Used to rename a file in the filesystem
    _service.renameFile = function (oldFilename, newFilename, callback) {
        var metaHash = 'file.rename-' + getHash();
        _renameFileCallbacks[metaHash] = callback
        var jsonRequest = {
            Message: "File Rename",
            Old: oldFilename,
            New: newFilename,
            Meta: {
                Hash: metaHash
            }
        };
        _comm.sendJson(jsonRequest);
    };


    // Called in response to trying to rename a file
    function fileRenameResponse(json) {
        if (json.Meta && json.Meta.Hash) {
            var callback = _renameFileCallbacks[json.Meta.Hash];
            if (callback) {
                var success = ('Fail' != json.Result);
                callback(success);
            }
        }
    }


    // Used to remove a single file from the JNIOR
    _service.removeFile = function (filename, callback) {
        _service.removeFiles([filename], callback);
    };


    // Used to remove multiple files from the JNIOR
    _service.removeFiles = function (filenames, callback) {
        var metaHash = 'file.remove-' + getHash();
        _removeFileCallbacks[metaHash] = callback;
        var jsonRequest = {
            Message: "File Remove",
            Files: filenames,
            Meta: {
                Hash: metaHash
            }
        };
        _comm.sendJson(jsonRequest);
    };


    // Called in response to tryng to remove a file
    function fileRemoveResponse(json) {
        if (json.Meta && json.Meta.Hash) {
            var callback = _removeFileCallbacks[json.Meta.Hash];
            if (callback) callback(json.Succeed);
        }
    }


    // Used to make a directory on the JNIOR
    _service.mkDir = function (directoryName, callback) {
        var metaHash = 'dir.make-' + getHash();
        _mkDirCallbacks[metaHash] = callback;
        var jsonRequest = {
            Message: "File Mkdir",
            Folder: directoryName,
            Meta: {
                Hash: metaHash
            }
        };
        _comm.sendJson(jsonRequest);
    };


    // Called in response to trying to make a directory
    function fileMkdirResponse(json) {
        var folder = json.Folder;
        var callbackIndex = folder;
        if (json.Meta && json.Meta.Hash) callbackIndex = json.Meta.Hash;

        var callback = _mkDirCallbacks[callbackIndex];
        if (callback) {
            callback(json);
        }
    }



    /**
     * External Devices
     */
    var _readDeviceCallbacks = [];


    // Used to read a single external device
    _service.readDevice = function (deviceId, callback) {
        // warn the user if a callback was not provided
        if (!callback) throw ("callback was not provided to readDevice()");
        if (null == callback) throw ("callback provided to readDevice() was null");
        if (!(callback instanceof Function)) throw ("callback provided to readDevice() is not a function");

        _service.readDevices([deviceId], callback);
    };


    // Used to read multiple external devices
    _service.readDevices = function (deviceIds, callback) {
        // warn the user if a callback was not provided
        if (!callback) throw ("callback was not provided to readDevices()");
        if (null == callback) throw ("callback provided to readDevices() was null");
        if (!(callback instanceof Function)) throw ("callback provided to readDevices() is not a function");

        for (var deviceIndex in deviceIds) {
            var deviceId = deviceIds[deviceIndex];
            _readDeviceCallbacks[deviceId] = callback;
        }
        var jsonRequest = {
            Message: "Read Devices",
            Devices: deviceIds
        };
        _comm.sendJson(jsonRequest);
    };


    // Called in response to reading an external device
    function readDevicesResponse(json) {
        for (var deviceIndex in json.Devices) {
            var device = json.Devices[deviceIndex];
            var deviceId = device.Address;
            var callback = _readDeviceCallbacks[deviceId];
            if (null !== callback) {
                callback(device);
            }
        }
    }



    /**
     * Custom Application Communication
     */
    var _onReplyMessageListeners = [];

    _service.addOnReplyMessageListener = function (callback) {
        _onReplyMessageListeners.push(callback);
    };

    // Used to a post a message to a java applcation running on the jnior with the given app_id
    _service.postMessage = function (appId, json) {
        var jsonString = JSON.stringify(json);
        var jsonRequest = {
            Message: "Post Message",
            Number: appId,
            Content: jsonString
        };
        _comm.sendJson(jsonRequest);
    };


    // Called when a Java application sends a message to the web server.  The data from that 
    // appllication will reside in the Content field
    function replyMessage(json) {
        //            if (_appId === json.Number) {
        if ("ping-resp" === json.Content) {
            console.log('ping acknolwedged');
        } else if (0 < _onReplyMessageListeners.length) {
            var contentJson = JSON.parse(json.Content);
            alertListeners(_onReplyMessageListeners, contentJson);
        } else {
            try {
                alertListeners(_onMessageListeners, json);
            } catch (err) {}
        }
        // any message received from the application should acknowledge the ping
        _pingAcknowledged = true;
        //            }
    }



    /**
     * Ping
     */
    var _pingAcknowledged = true;
    var _nextPing = new Date().getTime();

    _service.pingFailed = null;

    _service.initPing = function (appId) {
        _appId = appId;
        setInterval(_service.sendPing, 5000);
    };

}



function escapeUnicode(str) {
    return str.replace(/[\u00A0-\uffff]/gu, function (c) {
        return "\\u" + ("000" + c.charCodeAt().toString(16)).slice(-4)
    });
}


function unescapeUnicode(str) {
    return str.replace(/\\u[\da-fA-F]{4}/gu, function (c) {
        // console.log(c);
        var hexCode = c.substring(2);
        var hexValue = parseInt(hexCode, 16);
        var char = String.fromCharCode(hexValue);
        // console.log(char);
        return char;
    });
}