/*
 * Here are some helpful string manipulation functions that are used in this javascript file.  we 
 * need to make sure they exist.
 */
if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function (searchString, position) {
        position = position || 0;
        return this.indexOf(searchString, position) === position;
    };
}

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function (suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

if (typeof String.prototype.trimStrEnd !== 'function') {
    String.prototype.trimStrEnd = function (suffix) {
        var s = this;
        while (s.endsWith(suffix)) {
            s = s.substring(0, s.length - 1);
        }
        return s;
    };
}

if (typeof String.prototype.equalsIgnoreCase !== 'function') {
    String.prototype.equalsIgnoreCase = function (compareString) {
        return this.toLowerCase() === compareString.toLowerCase();
    };
}



/**
 * The websocket protocol with the INTEG JNIOR Series 4
 */
function JnrWebsocket() {
    var _service = this;
    var _comm = new Comm();



    function getHash() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }



    /**
     * addEventListener() - calls the correct method based on the given event.  this method will 
     * be responsible for adding the callback to the array of listeners.
     * 
     * @param {*} event - a string specifying the event to listen to
     * @param {*} callback - the function that will get called when the response or event is triggered
     */
    _service.addEventListener = function (event_type, callback) {
        event_type = event_type.toLowerCase();

        if ('onopened' == event_type) _service.addOnOpenedListener(callback);
        else if ('onclosed' == event_type) _service.addOnClosedListener(callback);
        else if ('onerror' == event_type) _service.addOnErrorListener(callback);

        else if ('onloggedin' == event_type) _service.addOnLoggedInListener(callback);

        else if ('onmessage' == event_type) _service.addOnMessageListener(callback);
        else if ('onreplymessage' == event_type) _service.addOnReplyMessageListener(callback);
    };


    /**
     * alerts all listeners in the given array
     * 
     * @param {*} listeners  - the array of listeners
     * @param {*} object - the object to pass to the listener
     */
    function alertListeners(listeners, object) {
        if (undefined !== listeners) {
            listeners.forEach(function (listener) {
                if (null == object) listener();
                else listener(object);
            });
        }
    }



    var _events = {};
    function appendEventCallbackListener(event_type, callback) {
        if (undefined === _events[event_type]) _events[event_type] = [];
        _events[event_type].push(callback);
    }



    /**
     * On Websocket Open
     */
    _service.addOnOpenedListener = function (callback) {
        appendEventCallbackListener('onopened', callback);
    };



    /**
     * On Websocket Close
     */
    _service.addOnClosedListener = function (callback) {
        appendEventCallbackListener('onclosed', callback);
    };



    /**
     * On WebSocket Error
     */
    _service.addOnErrorListener = function (callback) {
        appendEventCallbackListener('onerror', callback);
    };



    /**
     * Connects to a given URI.  if no URI is provided then the URI will be obtained from the 
     * window.host within the browser.
     * 
     * @param {*} uri 
     */
    _service.connect = function (uri = null) {
        if (uri) _comm.wsUri = uri;

        _comm.onopen = function () {
            alertListeners(_events["onopened"]);
        };

        _comm.onclose = function () {
            _loggedIn = false;
            alertListeners(_events["onclosed"]);
        };

        _comm.onerror = function () {
            alertListeners(_events["onerrorS"]);
        };

        _comm.onmessage = onmessage;

        _comm.connect();

        _service.sendJson = _comm.sendJson;
    };


    /**
     * @returns gets the uri used to connect to the websocket
     */
    _service.getWsUri = function () {
        return _comm.wsUri;
    };


    /**
     * used to close the websocket connection
     */
    _service.close = function () {
        _comm.close();
    }

    // Helper function to call the enable comm logging on the comm object
    _service.enableCommLogging = function (enabled = true) {
        _comm.enableCommLogging = enabled;
    };

    // Helper function to assign the authentication needed callback
    _service.setAuthenticationNeededCallback = function (callback) {
        _comm.onauth = callback;
    };

    _service.setCredentials = function (username, password) {
        _comm.username = username;
        _comm.password = password;
    };




    /**
     * The message handler
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
            } catch (err) { }
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
     * Output Control Functionality
     */

    /**
     * The "Toggle" command inverts the state of the defined output "Channel". If the relay is 
     * open it will be closed. If it is closed it will be opened.
     * 
     * Therefore the following will close Relay Output 1 assuming that it originally is open.
     * 
     * {
     *   "Message":"Control",
     *   "Command":"Toggle",
     *   "Channel":1
     * }
     * 
     * @param {int} channel - the output channel that should be toggled.  the channel should be 
     * specified from 1 to the number of outputs on the JNIOR while not exceeding 16.
     * @param {int} [duration] - the optional number of milliseconds before the relay is to be 
     * returned to its original state.  if specified this membermust be positive and non-zero 
     */
    _service.toggleOutput = function (channel, duration = 0) {
        var jsonRequest = {
            "Message": "Control",
            "Command": "Toggle",
            "Channel": channel
        };
        if (0 < duration) jsonRequest.duration = duration;
        _comm.sendJson(jsonRequest);
    };


    /**
     * The "closeOutput" command closes the defined output "Channel". If the relay is open it will 
     * be closed. If it is closed it will remain closed (state = 1).  There will be no change if 
     * the relay is already closed.
     * 
     * Therefore the following will close Relay Output 1.
     * 
     * {
     *   "Message":"Control",
     *   "Command":"Close",
     *   "Channel":1
     * }
     * 
     * @param {int} channel - the output channel that should be closed.  the channel should be 
     * specified from 1 to the number of outputs on the JNIOR while not exceeding 16.
     * @param {int} [duration] - the optional number of milliseconds before the relay is to be 
     * returned to its original state.  if specified this membermust be positive and non-zero 
     */
    _service.closeOutput = function (channel, duration) {
        var jsonRequest = {
            "Message": "Control",
            "Command": "Close",
            "Channel": channel
        };
        if (duration) jsonRequest.Duration = duration;
        _comm.sendJson(jsonRequest);
    };



    /**
     * The "openOutput" command opens the defined output "Channel". If the relay is currently 
     * closed it will be opened. If it is already opened then it will remain closed (state = 1).  
     * There will be no change if the relay is already closed.
     * 
     * Therefore the following will close Relay Output 1.
     * 
     * {
     *   "Message":"Control",
     *   "Command":"Open",
     *   "Channel":1
     * }
     * 
     * @param {int} channel - the output channel that should be closed.  the channel should be 
     * specified from 1 to the number of outputs on the JNIOR while not exceeding 16.
     * @param {int} [duration] - the optional number of milliseconds before the relay is to be 
     * returned to its original state.  if specified this membermust be positive and non-zero 
     */
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
    var _registryResponseCallbacks = [];
    var _registryResponseCallbacksByKeyName = [];
    var _registrySubscriptionCallbacks = [];
    // var _registryWriteCallbacks = [];
    var _registryListingCallbacks = [];


    _service.readRegistryKeyAsync = async function (keyname) {
        let promise = new Promise((resolve, reject) => {
            _service.readRegistryKey(keyname, function (keys_dict) {
                let key = Object.keys(keys_dict)[0]
                resolve(keys_dict[key]);
            });
        });

        return promise;
    }


    // Used to read a single key from the registry.  This function does not return a value
    // but rather the provided callback will be called when the value is returned.
    _service.readRegistryKey = function (key, callback) {
        _service.readRegistryKeys([key], callback);
    };


    _service.readRegistryKeysAsync = async function (keynames) {
        let promise = new Promise((resolve, reject) => {
            _service.readRegistryKeys(keynames, function (keys_dict) {
                resolve(keys_dict);
            });
        });

        return promise;
    }


    // Used to read multiple keys from the registry.  This function does not return a value
    // but rather the provided callback will be called when the value is returned.
    //
    // The returned value will be a dictionary with the key : value pairs
    // {
    //   key : value,
    //   key2 : value2,
    //   ...
    // }
    _service.readRegistryKeys = function (keys, callback) {
        var metaHash = 'reg.read-' + getHash();
        _registryResponseCallbacks[metaHash] = callback;
        // console.log('MetaHash:', metaHash);
        // console.log('_registryResponseCallbacks:', Object.keys(_registryResponseCallbacks).length);

        // for (var keyIndex in keys) {
        //     var key = keys[keyIndex];
        //     if (!_registryResponseCallbacksByKeyName[key] || null == _registryResponseCallbacksByKeyName[key]) {
        //         _registryResponseCallbacksByKeyName[key] = [];
        //     }
        //     var index = _registryResponseCallbacksByKeyName[key].indexOf(callback);
        //     if (-1 === index) {
        //         _registryResponseCallbacksByKeyName[key].push(callback);
        //     }
        // }

        var jsonRequest = {
            "Message": "Registry Read",
            "Keys": keys,
            Meta: { Hash: metaHash }
        };
        _comm.sendJson(jsonRequest);
    };


    // Used to read a single key from the registry.  This function does not return a value
    // but rather the provided callback will be called when the value is returned.  This is
    // the same as the readRegistryKey except that the callback is added to a different collection
    // that gets called whenever a registry update is provided for the given key.
    _service.registrySubscription = function (key, callback) {
        // add the callback to the callbacks dictionary by the lowercase version of the key
        _registrySubscriptionCallbacks[key.toLowerCase()] = callback;

        _service.readRegistryKey(key, callback);
    };


    // Called when a registry key is requested
    function registryResponse(json) {

        // get the callback for the received MetaHash
        var metaCallback = null;
        if (json.Meta && json.Meta.Hash) {
            metaCallback = _registryResponseCallbacks[json.Meta.Hash];
        } else {
            console.log('no meta or meta hash found');
        }

        // // go through each key value pair returned and call the callbacks.  we might have a 
        // // callback for the Meta Hash and the key name.  Actually we better have one for the Meta Hash
        // for (var key in json.Keys) {
        //     var value = json.Keys[key];

        //     // do we have a callback assigned based on the Meta Hash returned?
        //     if (null != metaCallback) {
        //         metaCallback(key, value);
        //     }

        //     // do we have any callbacks for the key name?
        //     var callback = _registryResponseCallbacksByKeyName[key];
        //     if (callback && null !== callback) {
        //         if (Array.isArray(callback)) {
        //             callback.forEach(function (cb) {
        //                 cb(key, value);
        //             });
        //         } else {
        //             callback(key, value);
        //         }
        //     }
        // }

        if (null != metaCallback) {
            metaCallback(json.Keys);
            delete _registryResponseCallbacks[json.Meta.Hash];
            // console.log('_registryResponseCallbacks:', Object.keys(_registryResponseCallbacks).length);
        }
    }


    // Called when a registry key changes
    function registryUpdate(json) {
        for (var key in json.Keys) {
            var value = json.Keys[key];

            // get any callbacks for the keys that are returned.
            var callback = _registrySubscriptionCallbacks[key.toLowerCase()];
            if (callback && null !== callback) {
                if (Array.isArray(callback)) {
                    callback.forEach(function (cb) {
                        cb(key, value);
                    });
                } else {
                    callback(key, value);
                }
            }
        }
    }


    _service.writeRegistryKeyAsync = async function (keyname, value) {
        let promise = new Promise((resolve, reject) => {
            _service.writeRegistryKey(keyname, value, function (keyname, value) {
                resolve(value);
            });
        });

        return promise;
    }

    // Used to write a registry key
    _service.registryWrite = _service.writeRegistryKey = function (key, value, callback) {

        if (null != callback) {
            var metaHash = 'reg.write-' + getHash();
            _registryResponseCallbacks[metaHash] = callback;
        }

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
    _service.getRegistryListing = function (node, callback) {
        if (null != callback) {
            var metaHash = 'reg.list-' + getHash();
            _registryListingCallbacks[metaHash] = callback;
        }

        var jsonRequest = {
            Message: "Registry List",
            "Meta": {
                Op: "registry",
                Node: node,
                Hash: metaHash
            },
            "Node": node
        };
        _comm.sendJson(jsonRequest);
    };

    _service.getRegistryListingAsync = async function (node) {
        let promise = new Promise((resolve, reject) => {
            _service.getRegistryListing(node, function (node, keys) {
                resolve(keys);
            });
        });

        return promise;
    }


    // Called when a registry listing is requested
    function registryListResponse(json) {
        try {
            var metaHash = json.Meta.Hash;
            var callback = _registryListingCallbacks[metaHash];
            if (callback) {
                callback(json.Meta.Node, json.Keys);
                delete _registryListingCallbacks[metaHash];
                // console.log('_registryResponseCallbacks:', Object.keys(_registryResponseCallbacks).length);
            }
        } catch (err) {
            console.error(err);
        }
    }



    /**
     * File System
     */
    var _fileListCallbacks = [];
    var _readFileCallbacks = [];
    var _writeFileCallbacks = [];
    var _mkDirCallbacks = [];
    var _renameFilePromises = [];
    var _removeFilePromises = [];

    /*
     * Used to get a file listing from the filesystem.  this method adds a supplied callback to 
     * the callback array and is called when the file listing response is returned
     */
    _service.getFileListingAsync = async function (folder) {
        let promise = new Promise((resolve, reject) => {
            _service.getFileListing(folder, function (folderContentArray) {
                folderContentArray.Content.forEach(function (item) {
                    item.Folder = folder;
                    if (!item.Folder.endsWith('/')) item.Folder += '/';
                });
                resolve(folderContentArray.Content);
            });
        });
        return promise;
    };

    // Used to get a file listing from the filesystem
    _service.getFileListing = function (folder, callback) {
        var metaHash = 'file.list-' + getHash();
        _writeFileCallbacks[metaHash] = callback;

        folder = folder.trimStrEnd('/');
        var jsonRequest = {
            Message: "File List",
            Folder: folder,
            Meta: { Hash: metaHash }
        };
        _comm.sendJson(jsonRequest);
    };


    // Called in response to a getfilelisting request
    function fileListResponse(json) {
        if (json.Status === "Fail") {
        } else {
            var folder = json.Folder;
            folder = folder.trimStrEnd('/');

            if (json.Meta && json.Meta.Hash) {
                var callback = _writeFileCallbacks[json.Meta.Hash];
                if (callback) callback(json);
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

        return promise;
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
            Meta: { Hash: metaHash }
        };
        _comm.sendJson(jsonRequest);
    };


    // Called in response to trying to read a file
    function fileReadResponse(json) {
        var file = json.File;

        // alert_callback(array, filename, hash)
        var callbackIndex = file;
        if (json.Meta && json.Meta.Hash) callbackIndex = json.Meta.Hash;
        var callback = _readFileCallbacks[callbackIndex];
        if (callback) callback(json);
    }


    // Used to download a file from the jnior
    _service.downloadFile = function (filename, callback) {
        if (!filename.startsWith('/')) {
            filename = '/' + filename;
        }
        var deferred = $.Deferred();
        _readFilePromises[filename] = deferred;

        var requestid = Math.floor(Math.random() * 1000000000000000);
        var url = document.baseURI;
        if (!url)
            url = location.href;
        var pos = url.indexOf("//");
        if (pos > 0) {
            pos = url.indexOf("/", pos + 2);
            if (pos > 0)
                url = url.substring(0, pos);
            url += "/query.cgi?request=" + requestid;
        }

        var jsonRequest = { Message: "File Read", Meta: url, File: filename, RequestID: requestid };
        _comm.sendJson(jsonRequest);
        return deferred.promise();
    };


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

        return promise;
    };


    // Used to write a file to the jnior
    _service.writeFile = _service.fileWrite = function (filename, fileData, callback) {
        _service.writeBase64File(filename, Base64.encode(fileData), callback);
    };



    // Used to write a file to the jnior
    _service.writeBase64File = function (filename, base64FileData, callback) {
        if (!filename.startsWith('/')) {
            filename = '/' + filename;
        }

        console.log("\r\n" + base64FileData);

        var metaHash = 'file.write-' + getHash();
        _writeFileCallbacks[metaHash] = callback;
        var jsonRequest = {
            Message: "File Write",
            File: filename,
            Size: calcBase64SizeInBytes(base64FileData),
            Encoding: "base64",
            Data: base64FileData,
            Meta: {
                Hash: metaHash
            }
        };
        _comm.sendJson(jsonRequest);
    };



    function calcBase64SizeInBytes(base64String) {
        var length = -1.0;
        if (base64String) {
            var padding = 0;
            if (base64String.endsWith("==")) padding = 2;
            else if (base64String.endsWith("=")) padding = 1;
            length = (Math.floor(base64String.length / 4) * 3) - padding;
        }
        return length;
    }



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

        return promise;
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


    // Used to remove a single file from the JNIOR asynchrously
    _service.removeFileAsync = async function (filename) {
        let promise = new Promise((resolve, reject) => {
            _service.removeFile(filename, function (result) {
                // the callback indicates that the workspace file has been read
                resolve(result);
            });
        });

        return promise;
    };



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
        _service.readDevices([deviceId], callback);
    };

    // Used to read multiple external devices
    _service.readDevices = function (deviceIds, callback) {
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
                var contentJson = JSON.parse(json.Content);
                alertListeners(_onMessageListeners, contentJson);
            } catch (err) { }
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
