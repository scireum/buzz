/**
 * MIT License
 *
 * Copyright (c) 2022 scireum GmbH
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (buzz) {

    /**
     * Contains the name of the default uplink being used.
     * @type {string}
     */
    const LINK_NAME_BUZZ_ROOT = 'buzzRoot';

    /**
     * Contains the name of the special link which is used by up- and downlinks to communicate with each other. Note
     * that message un this link are then auto-mapped to the proper "outside" link.
     * @type {string}
     */
    const LINK_NAME_UPLINK = 'uplink';

    /**
     * Defines the special message type used for request/response pattern.
     *
     * These patterns are created by "Connector.call" and "Message.reply".
     * @type {string}
     */
    const MESSAGE_TYPE_RESPONSE = 'response';

    /**
     * Defines the special message type which is used to query if the peer supports a capability/message-type.
     * @type {string}
     */
    const MESSAGE_TYPE_HAS_CAPABILITY = 'has-capability';

    /**
     * Used as prefix to generate unique message IDs.
     * @type {string}
     */
    const ID_PREFIX = Math.round(1000000 * Math.random()).toString(36);

    /**
     * Used as sequence counter to generate unique message IDs.
     * @type {number}
     */
    let idCounter = 0;

    /**
     * Generates a unique message ID.
     *
     * These IDs are mostly required in request/response scenarios.
     *
     * @returns {string} a unique message ID
     */
    function generateId() {
        return ID_PREFIX + '-' + (idCounter++);
    }

    /**
     * Determines if a given JSON object is a message which belongs to the given buzz link.
     *
     * @param {Object} message the message to check
     * @param {string} link the link to check for
     * @returns {boolean} true if the message belongs to the link, false otherwise
     */
    function isBuzzMessage(message, link) {
        return message.buzzLink === link;
    }

    /**
     * Creates a new message for the given connector.
     *
     * @param {Connector} connector the connector which received the message
     * @param {Object} message the message as JSON object
     * @constructor
     */
    buzz.Message = function (connector, message) {
        this.connector = connector;
        this.message = message;
    }

    /**
     * Extracts the actual payload from the given message.
     *
     * @returns {Object} the payload as JSON object
     */
    buzz.Message.prototype.payload = function () {
        return this.message.payload;
    }

    /**
     * Returns the message envelope itself.
     *
     * @returns {Object} the message envelope
     */
    buzz.Message.prototype.envelope = function () {
        return this.message;
    }

    /**
     * Sends a reply for this message.
     *
     * @param {Object} payload the payload as JSON object
     */
    buzz.Message.prototype.reply = function (payload) {
        this.connector.sendMessage(MESSAGE_TYPE_RESPONSE, {
            reply: this.message.messageId,
            receiver: this.message.sender
        }, payload);
    }

    /**
     * Creates a new buzz connector.
     *
     * @param {Object} options provides options to properly configure the connector
     * @param {string} [options.name] the name to be show to the peer. This could be the name of the system. If omitted it will be filled by the generated ID.
     * @param {string} [options.link] the name of the link to communicate on. This can be left empty, to use the default link
     * (to talk to outside callers via an uplink, or a dedicated name which is forwarded via a downlink).
     * @constructor
     */
    buzz.Connector = function (options) {
        this.uid = generateId();
        this.options = options;
        this.name = options.name || this.uid;
        this.link = options.link || LINK_NAME_BUZZ_ROOT;
        this.capabilities = {};
        this.waitingCalls = {};

        const _me = this;
        this.addCapability(MESSAGE_TYPE_HAS_CAPABILITY, function (message) {
            if (_me.capabilities.hasOwnProperty(message.payload().capability)) {
                message.reply({
                    uid: _me.uid,
                    name: _me.name
                });
            }
        });
        this.addCapability(MESSAGE_TYPE_RESPONSE, function (message) {
            if (_me.waitingCalls.hasOwnProperty(message.envelope().reply)) {
                _me.waitingCalls[message.envelope().reply](message);
                delete _me.waitingCalls[message.envelope().reply];
            }
        });

        window.addEventListener('message', function (event) {
            try {
                const data = JSON.parse(event.data);
                if (isBuzzMessage(data, _me.link) && data.sender !== _me.uid && (!data.receiver || data.receiver === _me.uid)) {
                    const callback = _me.capabilities[data.type];
                    if (callback != null) {
                        callback(new buzz.Message(_me, data));
                    }
                }
            } catch (ignored) {
            }
        });
    }

    /**
     * Registers a capability.
     * @param {string} capability the name of the capability
     * @param {function} callback the callback to invoke for incoming messages. This will receive a "Message" object.
     */
    buzz.Connector.prototype.addCapability = function (capability, callback) {
        this.capabilities[capability] = callback;
    }

    /**
     * Sends a message with the given payload.
     *
     * @param type the message type / capability to invoke
     * @param {Object} [envelope={}] the envelope to use for the message. This will most probably be left empty, as to common fields
     * of the envelope are managed by the library itself.
     * @param {Object} payload the payload to send
     * @returns {string} the ID of the message sent
     */
    buzz.Connector.prototype.sendMessage = function (type, envelope, payload) {
        const message = envelope || {};
        message.type = type;
        message.sender = this.uid;
        message.senderName = this.name;
        message.buzzLink = this.link;
        message.messageId = generateId();
        message.payload = payload;

        window.postMessage(JSON.stringify(message), "*");

        return message.messageId;
    }

    /**
     * Calls the given capability and handles the response in the given callback.
     *
     * @param type the message type / capability to invoke
     * @param {Object} [envelope={}] the envelope to use for the message. This will most probably be left empty, as to common fields
     * of the envelope are managed by the library itself.
     * @param {Object} payload the payload to send
     * @param {function} callback the callback to invoke once a response is received. This will receive a "Message" object.
     * @returns {string} the ID of the message sent
     */
    buzz.Connector.prototype.call = function (type, envelope, payload, callback) {
        const messageId = this.sendMessage(type, envelope, payload);
        this.waitingCalls[messageId] = callback;
        return messageId;
    }

    /**
     * Determines if the peer supports a given capability.
     * @param {string} capability the name of the capability to check
     * @param {function} callback the callback which is invoked if the peer supports the requested capability
     */
    buzz.Connector.prototype.queryCapability = function (capability, callback) {
        this.call(MESSAGE_TYPE_HAS_CAPABILITY, {}, {capability: capability}, callback);
    }


    /**
     * Enables the built-in debugger, which logs all messages to the console.
     */
    buzz.enableDebugger = function () {
        window.addEventListener('message', function (event) {
            try {
                const data = JSON.parse(event.data);
                if (data.buzzLink) {
                    console.log('BUZZ Message "'
                        + data.type
                        + '" on '
                        + data.buzzLink
                        + ' from '
                        + data.sender
                        + ' (' + data.senderName + '): '
                        + JSON.stringify(data.payload),
                        data);
                }
            } catch (ignored) {
            }
        });
    }

    /**
     * Connects the given iFrame to a buzz link.
     *
     * @param {HTMLIFrameElement} childFrame the iFrame to connect
     * @param {Object} options the options to pass in
     * @param {string} [options.link] the link to connect to. This can be left empty, to use the default link.
     * @param {Object} extensions a JSON object which will be appended to the payload of each message received from the
     * childFrame.
     */
    buzz.installDownlink = function (childFrame, options, extensions) {
        const link = options.link || LINK_NAME_BUZZ_ROOT;
        console.log('scireum BUZZ - Installing a downlink for bus ' + link + '... ', window, childFrame.contentWindow);
        window.addEventListener('message', function (event) {
            if (event.source === window) {
                // Send messages to child window...
                try {
                    const data = JSON.parse(event.data);
                    if (isBuzzMessage(data, link) && !data.uplink) {
                        data.buzzLink = LINK_NAME_BUZZ_ROOT;
                        childFrame.contentWindow.postMessage(JSON.stringify(data), '*');
                    }
                } catch (ignored) {
                    console.log(ignored);
                }
            } else if (event.source === childFrame.contentWindow) {
                // Receive messages from child window...
                try {
                    const data = JSON.parse(event.data);
                    if (isBuzzMessage(data, LINK_NAME_UPLINK)) {
                        data.buzzLink = link;
                        data.uplink = true;
                        for (var key in extensions) {
                            data.payload[key] = extensions[key];
                        }
                        window.postMessage(JSON.stringify(data), '*');
                    }
                } catch (ignored) {
                    console.log(ignored);
                }
            }
        });
    }

    /**
     * Installs an uplink to forward messages to the parent window if necessary.
     */
    function installUplink() {
        // If the library is initialized multiple times, we can skip this...
        if (buzz.uplinkInstalled) {
            return;
        }

        // If there is no parent window, we don't need an uplink...
        if (window.top === window.self) {
            return;
        }

        console.log('scireum BUZZ - Installing an uplink... ', window, window.parent);
        buzz.uplinkInstalled = true;
        window.addEventListener('message', function (event) {
            try {
                const data = JSON.parse(event.data);
                if (event.source !== window.parent) {
                    if (isBuzzMessage(data, LINK_NAME_BUZZ_ROOT)) {
                        data.buzzLink = LINK_NAME_UPLINK;
                        window.parent.postMessage(JSON.stringify(data), "*");
                    }
                }
            } catch (ignored) {
                console.log(ignored);
            }
        });
    }

    /**
     * Emits an event so to notify all users, that buzz is fully initialized.
     */
    function signalReadiness() {
        if (buzz.ready === true) {
            return;
        }
        buzz.ready = true;

        setTimeout(function () {
            if (typeof (CustomEvent) === 'function') {
                document.dispatchEvent(new CustomEvent('buzz-ready', {}));
            } else {
                const event = document.createEvent('Event');
                event.initEvent('buzz-ready', true, true);
                document.dispatchEvent(event);
            }
        }, 0);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Initializes the library within this window...
    // ---------------------------------------------------------------------------------------------------------
    installUplink();
    signalReadiness();

}(window.buzz = window.buzz || {}));
