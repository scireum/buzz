(function (scireum) {

    const LINK_NAME_BUZZ_ROOT = 'buzzRoot';
    const ID_PREFIX = Math.round(1000000*Math.random()).toString(36);
    let idCounter = 0;

    function generateId() { 
      return ID_PREFIX + '-' + (idCounter++);
    }
    
    function isBuzzMessage(message, link) {
        return message.buzzLink === link;
    }

    function BuzzDebugger() {
        window.addEventListener('message', function(event) { 
            try {
                const data = JSON.parse(event.data);
                if (data.buzzLink) {
                    console.log('scireum BUZZ Message on ' + data.buzzLink + ' from ' + data.sender, data);
                } 
            } catch(ignored) {}
        });
    }

    function BuzzUplink(childFrame, options) {
        const link = options.link || LINK_NAME_BUZZ_ROOT;
        const extensions = options.extensions || {};
        console.log('scireum BUZZ - Installing an uplink for bus ' + link + '... ', window, childFrame.contentWindow);
        window.addEventListener('message', function(event) { 
            if (event.source == window) {
                try {
                    const data = JSON.parse(event.data);
                    if (isBuzzMessage(data, link) && !data.uplink) {
                        data.buzzLink = LINK_NAME_BUZZ_ROOT;
                        childFrame.contentWindow.postMessage(JSON.stringify(data), '*');
                    } 
                } catch(ignored) {}
            } else if (event.source == childFrame.contentWindow) {
                try {
                    const data = JSON.parse(event.data);
                    if (isBuzzMessage(data, 'uplink')) {
                        data.buzzLink = link;
                        data.uplink = true;
                        for (const key in extensions) {
                            data.payload[key] = extensions[key];
                        }
                        window.postMessage(JSON.stringify(data), '*');
                    } 
                } catch(ignored) {}
            }
        });

        if (link !== LINK_NAME_BUZZ_ROOT) {
            childFrame.contentWindow.postMessage(JSON.stringify({
                command: 'rename-buzz-link',
                link: link
            }), '*');
        }
    }

    function BuzzMessage(connector, message) {
        this.connector = connector;
        this.message = message;
    }

    BuzzMessage.prototype.payload = function() {
        return this.message.payload;
    }
    BuzzMessage.prototype.envelope = function() {
        return this.message;
    }

    BuzzMessage.prototype.reply = function(payload) {
        this.connector.sendMessage('response', {
            reply: this.message.messageId,
            receiver: this.message.sender
        }, payload);
    }
    
    function BuzzConnector(options) {
        this.programIdentifier = options.identifier || generateId();
        this.uid = generateId();
        this.name = options.name || this.uid;
        this.options = options;
        this.link = options.link || LINK_NAME_BUZZ_ROOT;
        this.capabilities = {};
        this.waitingCalls = {};

        const _me = this;
        this.addCapability('has-capability', function(message) {
            if (_me.capabilities.hasOwnProperty(message.payload().capability)) {
                message.reply({
                    uid: _me.uid,
                    name: _me.name
                });    
            }
        });
        this.addCapability('response', function(message) {
            if (_me.waitingCalls.hasOwnProperty(message.envelope().reply)) {
                _me.waitingCalls[message.envelope().reply](message);
                delete  _me.waitingCalls[message.envelope().reply];
            }
        });
    
        window.addEventListener('message', function(event) { 
            try {
                const data = JSON.parse(event.data);
                if (isBuzzMessage(data, _me.link) && data.sender != _me.uid && (!data.receiver || data.receiver == _me.uid)) {
                    const callback = _me.capabilities[data.type];
                    if (callback != null) {
                        callback(new BuzzMessage(_me, data));
                    }
                } 
            } catch(ignored) {}
        });   
    }

    BuzzConnector.prototype.addCapability = function(capability, callback) {
        this.capabilities[capability] = callback;
    }
    
    BuzzConnector.prototype.sendMessage = function(type, envelope, payload) {
        const message = envelope || {};
        message.type = type;
        message.sender = this.uid;
        message.buzzLink = this.link;
        message.messageId = generateId();
        message.payload = payload;

        window.postMessage(JSON.stringify(message), "*");

        return message.messageId;
    }
    
    BuzzConnector.prototype.call = function(type, envelope, payload, callback) {
        const messageId = this.sendMessage(type, envelope, payload);
        this.waitingCalls[messageId] = callback;
    }
    
    BuzzConnector.prototype.queryCapability = function(capability, callback) {
        this.call('has-capability', {}, {capability: capability}, callback);
    }

    if (!scireum.buzzUplinkInstalled && window.top != window.self) {
        console.log('BUZZ - Installing a downlink... ', window, window.parent);
        scireum.buzzUplinkInstalled = true;
        window.addEventListener('message', function(event) { 
            try {
                const data = JSON.parse(event.data);
                if (event.source != window.parent) {
                    if (isBuzzMessage(data, LINK_NAME_BUZZ_ROOT)) {
                        data.buzzLink = 'uplink';
                        window.parent.postMessage(JSON.stringify(data), "*");
                    } 
                }
            } catch(ignored) {}
        });
    }

    setTimeout(function() {
        const event = new CustomEvent('buzz-ready', {});
        document.dispatchEvent(event);
    }, 0);
        
    scireum.BuzzDebugger = BuzzDebugger;
    scireum.BuzzUplink = BuzzUplink;
    scireum.BuzzConnector = BuzzConnector;
    
    }(window.scireum = window.scireum || {}));