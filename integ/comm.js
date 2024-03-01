/*
 JNIOR Monitor/Configuration Page
 INTEG Process Group, Inc., 2919 E Hardies Rd, Gibsonia PA 
 724.933.9350
 
 File: comm.js
 
 Javascript here creates a persistent Websocket connection back to the server. Initialize
 the connection as follows:
 
 var web_socket = new Comm();
 
 The user is hereby granted license to use, modify, and redistribute the contents of this
 file for any purpose, commercial or otherwise. No prior authorization by INTEG Process 
 Group, Inc. is required.
 */

function Comm() {
    var _this = this;

    /* the websocket object */
    _this.ws = null;
    _this.userClosed = false;

    /* some event callbacks */
    _this.onopen = null;
    _this.onmessage = null;
    _this.onclose = null;
    _this.onerror = null;
    _this.onauth = null;

    /* authentication information */
    _this.username = null;
    _this.password = null;
    _this.nonce = null;

    /* connection information */
    _this.conn = 0;
    _this.open = false;
    _this.auth = 0;

    /* debug flag */
    _this.enableCommLogging = false;

    // get current URI for the connection
    _this.wsUri = "ws://" + window.location.host;
    if (window.location.protocol == "https:")
        _this.wsUri = "wss://" + window.location.host;



    _this.connect = function () {
        try {
            // TRUE once we are open and receiving Monitor packets
            _this.open = false;
            _this.auth = 0;
            loggedin = false;

            // Indicates unique connection
            _this.conn++;

            // establish the connection
            _this.ws = new WebSocket(_this.wsUri);

            // send a blank message.  this prompts the jnior to send the
            // 401 Unauthorized message that supplies the NONCE needed to login
            _this.sendJson({
                'Message': ''
            });

            // an onerror handler for the websocket object.  this will call a user
            // defined onerror handler if there is one defined.
            _this.ws.onerror = function (evt) {
                if (_this.onerror) _this.onerror(evt);
            }.bind(this);

            // an onerror handler for the websocket object.  here we 
            _this.ws.onmessage = function (evt) {
                if (_this.enableCommLogging) {
                    console.log(_this.wsUri + ":   RECV <--:   " + evt.data);
                }

                var jobj = JSON.parse(evt.data);
                if (jobj['Message'] === 'Error') {
                    if (jobj['Text'] === '401 Unauthorized') {
                        _this.nonce = jobj['Nonce'];

                        // if this is our first attempt at logging in then we can either use any 
                        // supplied credentials of try the default ones.  if the login fails then we 
                        // better have an onauth callback defined to request new credentials.
                        var digest = "jnior:" + md5("jnior:" + _this.nonce + ":jnior");
                        if (_this.auth == 0) {
                            if (_this.username && _this.password) {
                                digest = _this.username + ":" + md5(_this.username + ":" + _this.nonce + ":" + _this.password);
                            }
                        } else {
                            if (_this.onauth) {
                                _this.onauth(evt);
                                return;
                            } else {
                                alert('onauth callback needed to get new credentials');
                                return;
                            }
                        }

                        // can provide autnentication now
                        var response = new Object();
                        response['Auth-Digest'] = digest;
                        _this.sendJson(response);
                        _this.auth++;
                    }
                } else {
                    if (!_this.open && jobj['Message'] === 'Monitor') {
                        // we are now open
                        _this.open = true;
                        if (_this.onopen)
                            _this.onopen(evt);
                    }
                    if (_this.onmessage)
                        _this.onmessage(evt);
                }
            }.bind(this);

            // called to provide authentication
            _this.authenticate = function (username, password) {
                if (_this.nonce && username && password) {
                    _this.auth = 0;
                    _this.username = username;
                    _this.password = password;
                    var digest = username + ":" + md5(username + ":" + _this.nonce + ":" + password);

                    var response = new Object();
                    response['Auth-Digest'] = digest;
                    _this.sendJson(response);
                    _this.auth++;
                    _this.nonce = null;
                }
            }.bind(this);

            // cause reconnect if we close		
            _this.ws.onclose = function (evt) {
                if (_this.onclose) _this.onclose(evt);
                reconnect();
            }.bind(this);

        } catch (ex) {
            if (_this.onerror) _this.onerror(ex);
        }
    };



    var reconnect = function () {
        if ((!_this.ws || _this.ws.readyState == 3) && !_this.userClosed)
            _this.connect();
    }.bind(this);

    // background check to catch any odd disconnect
    setInterval(reconnect, 5000);



    _this.close = function () {
        if (_this.ws) {
            _this.userClosed = true;
            _this.ws.close();
        }
    };



    _this.sendJson = function (json) {
        // wait for socket ready to send
        socketWait(_this.conn, function () {
            var message = JSON.stringify(json);
            if (_this.enableCommLogging) {
                console.log(_this.wsUri + ":   SEND -->:   " + message);
            }
            _this.ws.send(message);
        }.bind(this));
    }.bind(this);



    var socketWait = function (conn, callback) {
        if (conn == _this.conn) {
            if (_this.ws.readyState === 1) {
                if (callback != null)
                    callback();
                return;
            } else if (_this.ws.readyState === 0)
                setTimeout(function () {
                    socketWait(conn, callback);
                }.bind(this), 1000);
        }
    }.bind(this);
};



function istrue(str) {
    var val = str.trim();
    val = val.toLowerCase();
    if (val === "1" ||
        val === "on" ||
        val === "yes" ||
        val === "true" ||
        val === "enable" ||
        val === "enabled")
        return (true);
    return (false);
}