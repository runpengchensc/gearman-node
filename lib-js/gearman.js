// Generated by CoffeeScript 1.10.0
(function() {
  var EventEmitter, Gearman, _, assert, nextTick, reconnect, uid,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require("events").EventEmitter;

  _ = require('underscore');

  assert = require('assert');

  reconnect = require('reconnect-net');

  nextTick = require('timers').setImmediate || process.nextTick;

  uid = 0;

  Gearman = (function(superClass) {
    extend(Gearman, superClass);

    function Gearman(host, port, debug) {
      var key, ref, val;
      this.host = host != null ? host : 'localhost';
      this.port = port != null ? port : 4730;
      this.debug = debug != null ? debug : false;
      this.uid = (uid += 1);
      this.packetTypes = {
        CAN_DO: 1,
        CANT_DO: 2,
        RESET_ABILITIES: 3,
        PRE_SLEEP: 4,
        NOOP: 6,
        SUBMIT_JOB: 7,
        JOB_CREATED: 8,
        GRAB_JOB: 9,
        NO_JOB: 10,
        JOB_ASSIGN: 11,
        WORK_STATUS: 12,
        WORK_COMPLETE: 13,
        WORK_FAIL: 14,
        GET_STATUS: 15,
        ECHO_REQ: 16,
        ECHO_RES: 17,
        SUBMIT_JOB_BG: 18,
        ERROR: 19,
        STATUS_RES: 20,
        SUBMIT_JOB_HIGH: 21,
        SET_CLIENT_ID: 22,
        CAN_DO_TIMEOUT: 23,
        ALL_YOURS: 24,
        WORK_EXCEPTION: 25,
        OPTION_REQ: 26,
        OPTION_RES: 27,
        WORK_DATA: 28,
        WORK_WARNING: 29,
        GRAB_JOB_UNIQ: 30,
        JOB_ASSIGN_UNIQ: 31,
        SUBMIT_JOB_HIGH_BG: 32,
        SUBMIT_JOB_LOW: 33,
        SUBMIT_JOB_LOW_BG: 34,
        SUBMIT_JOB_SCHED: 35,
        SUBMIT_JOB_EPOCH: 36
      };
      this.packetTypesReversed = {};
      ref = this.packetTypes;
      for (key in ref) {
        val = ref[key];
        this.packetTypesReversed[val] = key;
      }
      this.connected = this.connecting = false;
      this.remainder = new Buffer("");
      this.commandQueue = [];
      this.handleCallbackQueue = [];
      this.currentJobs = {};
      this.currentWorkers = {};
      this.workers = {};
      this.paramCount = {
        ERROR: ["string", "string"],
        JOB_ASSIGN: ["string", "string", "buffer"],
        JOB_ASSIGN_UNIQ: ["string", "string", "string", "buffer"],
        JOB_CREATED: ["string"],
        WORK_COMPLETE: ["string", "buffer"],
        WORK_EXCEPTION: ["string", "buffer"],
        WORK_WARNING: ["string", "string"],
        WORK_DATA: ["string", "buffer"],
        WORK_FAIL: ["string"],
        WORK_STATUS: ["string", "number", "number"]
      };
    }

    Gearman.prototype.connect = function() {
      if (this.connected || this.connecting) {
        return;
      }
      this.connecting = true;
      if (this.debug) {
        console.log("GEARMAN " + this.uid + ": connecting...");
      }
      this.reconnecter = reconnect((function(_this) {
        return function(socket) {
          if (_this.debug) {
            console.log("GEARMAN " + _this.uid + ": connected!");
          }
          _this.socket = socket;
          _this.socket.on("error", _this.errorHandler.bind(_this));
          _this.socket.on("data", _this.receive.bind(_this));
          _this.socket.setKeepAlive(true);
          _this.connecting = false;
          _this.connected = true;
          _this.emit("connect");
          return _this.processCommandQueue();
        };
      })(this));
      this.reconnecter.on('disconnect', (function(_this) {
        return function() {
          console.error("GEARMAN " + _this.uid + ": disconnected");
          return _this.connected = false;
        };
      })(this));
      this.reconnecter.on('reconnect', (function(_this) {
        return function() {
          console.error("GEARMAN " + _this.uid + ": attempting reconnect!");
          return _this.connecting = true;
        };
      })(this));
      return this.reconnecter.connect({
        host: this.host,
        port: this.port
      });
    };

    Gearman.prototype.disconnect = function() {
      if (!this.connected) {
        return;
      }
      this.reconnecter.reconnect = false;
      this.connected = false;
      this.connecting = false;
      if (this.socket) {
        try {
          this.socket.end();
        } catch (undefined) {}
      }
      if (this.debug) {
        console.log("GEARMAN " + this.uid + ": disconnected");
      }
      return this.emit('disconnect');
    };

    Gearman.prototype.errorHandler = function(err) {
      this.emit("error", err);
      return this.disconnect();
    };

    Gearman.prototype.sendCommand = function() {
      this.commandQueue.push(_.toArray(arguments));
      return this.processCommandQueue();
    };

    Gearman.prototype.processCommandQueue = function() {
      if (this.commandQueue.length === 0 || !this.connected) {
        return;
      }
      return this.sendCommandToServer.apply(this, this.commandQueue.shift());
    };

    Gearman.prototype.sendCommandToServer = function() {
      var arg, args, body, bodyLength, commandId, commandName, curpos, i, j, k, l, len, len1, len2, ref, ref1;
      assert(this.connected);
      args = _.toArray(arguments);
      if (this.debug) {
        console.log("GEARMAN " + this.uid + ": sendCommandToServer", args);
      }
      commandName = (args.shift() || "").trim().toUpperCase();
      commandId = this.packetTypes[commandName];
      assert(commandId != null, "unhandled command " + commandName);
      bodyLength = 0;
      ref = _.range(args.length);
      for (j = 0, len = ref.length; j < len; j++) {
        i = ref[j];
        if (!(args[i] instanceof Buffer)) {
          args[i] = new Buffer("" + (args[i] || ''), "utf-8");
        }
        bodyLength += args[i].length;
      }
      bodyLength += args.length > 1 ? args.length - 1 : 0;
      body = new Buffer(bodyLength + 12);
      body.writeUInt32BE(0x00524551, 0);
      body.writeUInt32BE(commandId, 4);
      body.writeUInt32BE(bodyLength, 8);
      curpos = 12;
      ref1 = _.range(args.length);
      for (k = 0, len1 = ref1.length; k < len1; k++) {
        i = ref1[k];
        args[i].copy(body, curpos);
        curpos += args[i].length;
        if (i < args.length - 1) {
          body[curpos++] = 0x00;
        }
      }
      if (this.debug) {
        console.log("GEARMAN " + this.uid + ": sending " + commandName + " with " + args.length + " arguments:");
        for (i = l = 0, len2 = args.length; l < len2; i = ++l) {
          arg = args[i];
          console.log("\targ[" + i + "]: ", "" + arg, arg);
        }
      }
      return this.socket.write(body, this.processCommandQueue.bind(this));
    };

    Gearman.prototype.receive = function(chunk) {
      var arg, argType, argTypes, argpos, args, bodyLength, commandId, commandName, curarg, curpos, i, j, k, len, len1, packet;
      this.remainder = Buffer.concat([this.remainder, chunk]);
      while (this.remainder.length >= 12) {
        if ((this.remainder.readUInt32BE(0)) !== 0x00524553) {
          return this.errorHandler(new Error("Out of sync with server"));
        }
        bodyLength = this.remainder.readUInt32BE(8);
        if (this.remainder.length < 12 + bodyLength) {
          return;
        }
        packet = this.remainder.slice(0, 12 + bodyLength);
        this.remainder = this.remainder.slice(12 + bodyLength);
        commandId = packet.readUInt32BE(4);
        commandName = this.packetTypesReversed[commandId];
        assert(commandName != null, "unhandled command " + commandName);
        args = [];
        if (bodyLength && (argTypes = this.paramCount[commandName])) {
          curpos = 12;
          argpos = 12;
          for (i = j = 0, len = argTypes.length; j < len; i = ++j) {
            argType = argTypes[i];
            curarg = packet.slice(argpos);
            if (i < argTypes.length - 1) {
              while (packet[curpos] !== 0x00 && curpos < packet.length) {
                curpos++;
              }
              curarg = packet.slice(argpos, curpos);
            }
            switch (argTypes[i]) {
              case "string":
                curarg = curarg.toString("utf-8");
                break;
              case "number":
                curarg = Number(curarg.toString()) || 0;
            }
            args.push(curarg);
            curpos++;
            argpos = curpos;
            if (curpos >= packet.length) {
              break;
            }
          }
        }
        if (this.debug) {
          console.log("GEARMAN " + this.uid + ": received " + commandName + " with " + args.length + " arguments:");
          for (i = k = 0, len1 = args.length; k < len1; i = ++k) {
            arg = args[i];
            console.log("\targ[" + i + "]: ", "" + arg, arg);
          }
        }
        this.emit.apply(this, [commandName].concat(args));
      }
    };

    return Gearman;

  })(EventEmitter);

  module.exports = Gearman;

}).call(this);