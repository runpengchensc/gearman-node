// Generated by CoffeeScript 1.10.0

/*

Supported Worker Requests
----------------

CAN_DO: sent to notify the server that the worker is able to
    perform the given function. The worker is then put on a list to be
    woken up whenever the job server receives a job for that function.

    Arguments:
    - Function name.

CAN_DO_TIMEOUT: same as CAN_DO, but with a timeout value on how long the job
     is allowed to run. After the timeout value, the job server will
     mark the job as failed and notify any listening clients.

     Arguments:
     - NULL byte terminated Function name.
     - Timeout value.

PRE_SLEEP: sent to notify the server that the worker is about to
    sleep, and that it should be woken up with a NOOP packet if a
    job comes in for a function the worker is able to perform.

GRAB_JOB: sent to the server to request any available jobs on the
    queue. The server will respond with either NO_JOB or JOB_ASSIGN,
    depending on whether a job is available.

WORK_DATA: sent to update the client with data from a running job. A
    worker should use this when it needs to send updates, send partial
    results, or flush data during long running jobs. It can also be
    used to break up a result so the worker does not need to buffer
    the entire result before sending in a WORK_COMPLETE packet.

    Arguments:
    - NULL byte terminated job handle.
    - Opaque data that is returned to the client.

WORK_WARNING: sent to update the client with a warning. It acts just
    like a WORK_DATA response, but should be treated as a warning
    instead of normal response data.

    Arguments:
    - NULL byte terminated job handle.
    - Opaque data that is returned to the client.

WORK_STATUS: sent to update the server (and any listening clients)
    of the status of a running job. The worker should send these
    periodically for long running jobs to update the percentage
    complete. The job server should store this information so a client
    who issued a background command may retrieve it later with a
    GET_STATUS request.

    Arguments:
    - NULL byte terminated job handle.
    - NULL byte terminated percent complete numerator.
    - Percent complete denominator.

WORK_COMPLETE: notifies the server (and any listening clients) that
    the job completed successfully.

    Arguments:
    - NULL byte terminated job handle.
    - Opaque data that is returned to the client as a response.

WORK_FAIL: notifies the server (and any listening clients) that
    the job failed.

    Arguments:
    - Job handle.

SET_CLIENT_ID: sets the worker ID in a job server so monitoring and reporting
    commands can uniquely identify the various workers, and different
    connections to job servers from the same worker.

    Arguments:
    - Unique string to identify the worker instance.

Unsupported worker requests:
CANT_DO
RESET_ABILITIES
GRAB_JOB_UNIQ
WORK_EXCEPTION (deprecated)
ALL_YOURS

Supported Responses to Worker
----------------
NOOP: used to wake up a sleeping worker so that it may grab a
    pending job.

    Arguments:
    - None.

NO_JOB: sent in response to a GRAB_JOB request to notify the
    worker there are no pending jobs that need to run.

    Arguments:
    - None.

JOB_ASSIGN: given in response to a GRAB_JOB request to give the worker
    information needed to run the job. All communication about the
    job (such as status updates and completion response) should use
    the handle, and the worker should run the given function with
    the argument.

    Arguments:
    - NULL byte terminated job handle.
    - NULL byte terminated function name.
    - Opaque data that is given to the function as an argument.

Unsupported responses:
JOB_ASSIGN_UNIQ
 */

(function() {
  var EventEmitter, Gearman, Worker, _, async,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Gearman = require('./gearman');

  _ = require('underscore');

  async = require('async');

  EventEmitter = require("events").EventEmitter;

  Worker = (function(superClass) {
    var WorkerHelper;

    extend(Worker, superClass);

    function Worker(name1, fn, options) {
      this.name = name1;
      this.fn = fn;
      this.options = options;
      this._receive_job = bind(this._receive_job, this);
      this._get_next_job = bind(this._get_next_job, this);
      this._register_worker = bind(this._register_worker, this);
      this.shutdown = bind(this.shutdown, this);
      this.work_in_progress = false;
      this.active = true;
      this.options = _.defaults(this.options || {}, {
        host: 'localhost',
        port: 4730,
        debug: false
      });
      Worker.__super__.constructor.call(this, this.options.host, this.options.port, this.options.debug);
      this.on('NO_JOB', (function(_this) {
        return function() {
          return _this.sendCommand('PRE_SLEEP');
        };
      })(this));
      this.on('NOOP', (function(_this) {
        return function() {
          return _this._get_next_job();
        };
      })(this));
      this.on('JOB_ASSIGN', this._receive_job.bind(this));
      this.on('connect', (function(_this) {
        return function() {
          return _this._register_worker();
        };
      })(this));
      this.connect();
    }

    Worker.prototype.shutdown = function(done) {
      this.active = false;
      return async.whilst((function(_this) {
        return function() {
          var ref;
          return ((ref = _this.socket) != null ? ref.bufferSize : void 0) > 0 || _this.work_in_progress;
        };
      })(this), function(cb) {
        return setTimeout(cb, 1000);
      }, done);
    };

    Worker.prototype._register_worker = function() {
      this.sendCommand('RESET_ABILITIES');
      if (this.options.timeout != null) {
        this.sendCommand('CAN_DO_TIMEOUT', this.name, this.options.timeout);
      } else {
        this.sendCommand('CAN_DO', this.name);
      }
      return this._get_next_job();
    };

    Worker.prototype._get_next_job = function() {
      if (this.active) {
        return this.sendCommand('GRAB_JOB');
      }
    };

    Worker.prototype._receive_job = function(handle, name, payload) {
      return this.fn(payload, new WorkerHelper(this, handle));
    };

    WorkerHelper = (function(superClass1) {
      extend(WorkerHelper, superClass1);

      function WorkerHelper(parent, handle1) {
        this.parent = parent;
        this.handle = handle1;
        this.done = bind(this.done, this);
        this.complete = bind(this.complete, this);
        this.error = bind(this.error, this);
        this.data = bind(this.data, this);
        this.status = bind(this.status, this);
        this.warning = bind(this.warning, this);
        this.parent.work_in_progress = true;
      }

      WorkerHelper.prototype.warning = function(warning) {
        return this.parent.sendCommand('WORK_WARNING', this.handle, warning);
      };

      WorkerHelper.prototype.status = function(num, den) {
        return this.parent.sendCommand('WORK_STATUS', this.handle, num, den);
      };

      WorkerHelper.prototype.data = function(data) {
        return this.parent.sendCommand('WORK_DATA', this.handle, data);
      };

      WorkerHelper.prototype.error = function(warning) {
        if (warning != null) {
          this.warning(warning);
        }
        this.parent.sendCommand('WORK_FAIL', this.handle);
        this.parent.work_in_progress = false;
        return this.parent._get_next_job();
      };

      WorkerHelper.prototype.complete = function(data) {
        this.parent.sendCommand('WORK_COMPLETE', this.handle, data);
        this.parent.work_in_progress = false;
        return this.parent._get_next_job();
      };

      WorkerHelper.prototype.done = function(err) {
        if (err != null) {
          return this.error(err);
        } else {
          return this.complete();
        }
      };

      return WorkerHelper;

    })(EventEmitter);

    return Worker;

  })(Gearman);

  module.exports = Worker;

}).call(this);