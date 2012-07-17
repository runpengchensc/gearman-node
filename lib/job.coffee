Stream = require("stream").Stream

class Job extends Stream
  initialize: (@gearman, @name, @payload) ->
    @timeoutTimer = null
    @gearman.sendCommand "SUBMIT_JOB", @name, false, @payload, @receiveHandle.bind(@)

  setTimeout: (timeout, timeoutCallback) ->
    @timeoutValue = timeout
    @timeoutCallback = timeoutCallback
    @updateTimeout()

  updateTimeout: () ->
    if @timeoutValue
      clearTimeout @timeoutTimer
      @timeoutTimer = setTimeout(@onTimeout.bind(@), @timeoutValue)

  onTimeout: () ->
    delete @gearman.currentJobs[@handle] if @handle
    unless @aborted
      @abort()
      error = new Error("Timeout exceeded for the job")
      if typeof @timeoutCallback is "function"
        @timeoutCallback error
      else
        @emit "timeout", error

  abort: () ->
    clearTimeout @timeoutTimer
    @aborted = true

  receiveHandle: (handle) ->
    if handle
      @handle = handle
      @gearman.currentJobs[handle] = @
    else
      @emit "error", new Error("Invalid response from server")

module.exports = Job