/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var Guacamole = Guacamole || {};

/**
 * Abstract camera recorder which streams H.264 video data to an underlying
 * Guacamole.OutputStream. It is up to implementations of this class to provide
 * some means of handling this Guacamole.OutputStream. Data produced by the
 * recorder is to be sent along the provided stream immediately.
 *
 * @constructor
 */
Guacamole.CameraRecorder = function CameraRecorder() {

    /**
     * Callback which is invoked when the camera recording process has stopped
     * and the underlying Guacamole stream has been closed normally. Camera will
     * only resume recording if a new Guacamole.CameraRecorder is started. This
     * Guacamole.CameraRecorder instance MAY NOT be reused.
     *
     * @event
     */
    this.onclose = null;

    /**
     * Callback which is invoked when the camera recording process cannot
     * continue due to an error, if it has started at all. The underlying
     * Guacamole stream is automatically closed. Future attempts to record
     * camera should not be made, and this Guacamole.CameraRecorder instance
     * MAY NOT be reused.
     *
     * @event
     */
    this.onerror = null;

    /**
     * Callback invoked when the recorder has determined the set of formats
     * supported by the underlying camera (resolution and frame rate pairs).
     *
     * @event
     * @param {!Array.<Object>} formats
     *     Array describing the supported formats. Each element contains
     *     at least {width, height, fpsNumerator, fpsDenominator}.
     * @param {string} deviceName
     *     The label/name of the camera device, if available.
     */
    this.oncapabilities = null;

};

/**
 * Determines whether the given mimetype is supported by any built-in
 * implementation of Guacamole.CameraRecorder, and thus will be properly handled
 * by Guacamole.CameraRecorder.getInstance().
 *
 * @param {!string} mimetype
 *     The mimetype to check.
 *
 * @returns {!boolean}
 *     true if the given mimetype is supported by any built-in
 *     Guacamole.CameraRecorder, false otherwise.
 */
Guacamole.CameraRecorder.isSupportedType = function isSupportedType(mimetype) {

    return Guacamole.H264CameraRecorder.isSupportedType(mimetype);

};

/**
 * Returns a list of all mimetypes supported by any built-in
 * Guacamole.CameraRecorder, in rough order of priority. Beware that only the
 * core mimetypes themselves will be listed. Any mimetype parameters, even
 * required ones, will not be included in the list.
 *
 * @returns {!string[]}
 *     A list of all mimetypes supported by any built-in
 *     Guacamole.CameraRecorder, excluding any parameters.
 */
Guacamole.CameraRecorder.getSupportedTypes = function getSupportedTypes() {

    return Guacamole.H264CameraRecorder.getSupportedTypes();

};

/**
 * Returns an instance of Guacamole.CameraRecorder providing support for the
 * given video format. If support for the given video format is not available,
 * null is returned.
 *
 * @param {!Guacamole.OutputStream} stream
 *     The Guacamole.OutputStream to send video data through.
 *
 * @param {!string} mimetype
 *     The mimetype of the video data to be sent along the provided stream.
 *
 * @return {Guacamole.CameraRecorder}
 *     A Guacamole.CameraRecorder instance supporting the given mimetype and
 *     writing to the given stream, or null if support for the given mimetype
 *     is absent.
 */
Guacamole.CameraRecorder.getInstance = function getInstance(stream, mimetype) {

    // Use H.264 camera recorder if possible
    if (Guacamole.H264CameraRecorder.isSupportedType(mimetype))
        return new Guacamole.H264CameraRecorder(stream, mimetype);

    // No support for given mimetype
    return null;

};

/**
 * Implementation of Guacamole.CameraRecorder providing support for H.264
 * format video. This recorder relies on the WebCodecs API and requires
 * browser-level support for H.264 encoding.
 *
 * @constructor
 * @augments Guacamole.CameraRecorder
 * @param {!Guacamole.OutputStream} stream
 *     The Guacamole.OutputStream to write video data to.
 *
 * @param {!string} mimetype
 *     The mimetype of the video data to send along the provided stream, which
 *     must be "application/rdpecam+h264".
 */
Guacamole.H264CameraRecorder = function H264CameraRecorder(stream, mimetype) {

    /**
     * Reference to this H264CameraRecorder.
     *
     * @private
     * @type {!Guacamole.H264CameraRecorder}
     */
    var recorder = this;

    /** The format of video this recorder will encode. */
    var format = {
        width: 640,
        height: 480,
        frameRate: 30,
        /** Optional browser device ID to target a specific camera */
        deviceId: undefined
    };

    var CONSERVATIVE_CLIENT_MAX_WIDTH = 640;
    var CONSERVATIVE_CLIENT_MAX_HEIGHT = 480;
    var CONSERVATIVE_CLIENT_FIXED_FPS = 10;
    var CADENCE_REPEAT_MULTIPLIER = 2;
    var CAMERA_STALL_TIMEOUT_MS = 5000;

    /**
     * Returns the browser user agent string if available.
     *
     * @private
     * @returns {string}
     */
    var getUserAgentString = function getUserAgentString() {
        if (typeof navigator === 'undefined')
            return '';

        return navigator.userAgent || '';
    };

    /**
     * Emits an RDPECAM debug event through the optional global hook installed
     * by the webapp.
     *
     * @private
     * @param {string} eventName
     *     Short event name.
     *
     * @param {Object} payload
     *     Event payload.
     */
    var emitDebugEvent = function emitDebugEvent(eventName, payload) {
        if (typeof window === 'undefined')
            return;

        var hook = window.GUAC_RDPECAM_DEBUG_HOOK;
        if (typeof hook !== 'function')
            return;

        try {
            hook(eventName, payload || {});
        }
        catch (e) {}
    };

    /**
     * Returns a JSON-safe representation of the given constraints object for
     * debug telemetry.
     *
     * @private
     * @param {(Object|boolean)} constraints
     * @returns {(Object|boolean|string)}
     */
    var sanitizeConstraintsForDebug = function sanitizeConstraintsForDebug(constraints) {
        if (typeof constraints === 'boolean')
            return constraints;

        try {
            return JSON.parse(JSON.stringify(constraints || {}));
        }
        catch (e) {
            return String(constraints);
        }
    };

    /**
     * Returns whether the current browser should follow Android/mobile camera
     * handling logic. HarmonyOS/OHOS is intentionally treated as Android-like.
     *
     * @private
     * @returns {boolean}
     */
    var isAndroidLikeBrowser = function isAndroidLikeBrowser() {
        var userAgent = getUserAgentString();
        return /Android|HarmonyOS|OHOS|HongMeng/i.test(userAgent);
    };

    /**
     * Returns whether the current browser should follow Linux desktop camera
     * handling logic.
     *
     * @private
     * @returns {boolean}
     */
    var isLinuxDesktopBrowser = function isLinuxDesktopBrowser() {
        var userAgent = getUserAgentString();
        return /Linux/i.test(userAgent) && !isAndroidLikeBrowser();
    };

    /**
     * Monotonic PTS last emitted downstream (milliseconds).
     *
     * @private
     * @type {?number}
     */
    var lastOutputPtsMs = null;

    /**
     * Tracks whether capability information has already been reported
     * upstream for this recorder.
     *
     * @private
     * @type {boolean}
     */
    var capabilitiesReported = false;

    /**
     * Candidate formats which will be offered if supported by the camera.
     *
     * @private
     * @type {!Array.<{width:number,height:number,fps:!Array.<number>}>}
     */
    var CAPABILITY_CANDIDATES = [
        { width: 640,  height: 480,  fps: [30, 15, 10] },
        { width: 320,  height: 240,  fps: [30, 15, 10] },
        { width: 1280, height: 720,  fps: [30]      },
        { width: 1920, height: 1080, fps: [30]      }
    ];

    /**
     * Conservative format list for Android-like browsers, including HarmonyOS.
     *
     * @private
     * @type {!Array.<{width:number,height:number,fps:!Array.<number>}>}
     */
    var MOBILE_CAPABILITY_CANDIDATES = [
        { width: 640,  height: 480,  fps: [10, 15] },
        { width: 320,  height: 240,  fps: [10, 15] }
    ];

    /**
     * Returns whether the provided dimension capability includes the given
     * value. Capabilities may be expressed as ranges, arrays, or omitted.
     *
     * @private
     */
    var capabilitySupportsValue = function capabilitySupportsValue(capability, value) {
        if (!capability)
            return true;

        if (Array.isArray(capability))
            return capability.indexOf(value) !== -1;

        if (typeof capability === 'object') {
            if (typeof capability.max === 'number' && value > capability.max)
                return false;
            if (typeof capability.min === 'number' && value < capability.min)
                return false;
            if (typeof capability.step === 'number' && typeof capability.min === 'number') {
                var step = capability.step;
                if (step > 0 && ((value - capability.min) % step) !== 0)
                    return false;
            }
        }

        return true;
    };

    /**
     * Builds a list of supported formats from the provided
     * MediaTrackCapabilities. The resulting list is guaranteed to contain at
     * least the currently requested format.
     *
     * @private
     */
    var buildSupportedFormats = function buildSupportedFormats(capabilities) {
        var formats = [];
        var seen = {};
        var androidLike = isAndroidLikeBrowser();
        var linuxDesktop = isLinuxDesktopBrowser();
        var candidates = androidLike ? MOBILE_CAPABILITY_CANDIDATES : CAPABILITY_CANDIDATES;

        var pushFormat = function pushFormat(width, height, fpsNum, fpsDen) {
            var key = width + 'x' + height + '@' + fpsNum + '/' + fpsDen;
            if (seen[key])
                return;

            seen[key] = true;
            formats.push({
                width: width,
                height: height,
                fpsNumerator: fpsNum,
                fpsDenominator: fpsDen
            });
        };

        candidates.forEach(function(candidate) {
            if (!capabilitySupportsValue(capabilities.width, candidate.width))
                return;
            if (!capabilitySupportsValue(capabilities.height, candidate.height))
                return;

            var fpsCandidates = candidate.fps.slice();
            if (linuxDesktop || androidLike) {
                fpsCandidates.sort(function(a, b) {
                    return a - b;
                });
            }

            fpsCandidates.forEach(function(fps) {
                if (!capabilitySupportsValue(capabilities.frameRate, fps))
                    return;
                pushFormat(candidate.width, candidate.height, fps, 1);
            });
        });

        if (!formats.length) {
            pushFormat(format.width, format.height,
                typeof format.frameRate === 'number' && format.frameRate > 0 ? format.frameRate : 30, 1);
        }

        return formats;
    };

    /**
     * Reports the supported formats upstream exactly once if the recorder
     * consumer has provided an oncapabilities handler.
     *
     * @private
     */
    var reportCapabilities = function reportCapabilities(track) {
        if (capabilitiesReported || !track || typeof track.getCapabilities !== 'function')
            return;

        try {
            var caps = track.getCapabilities();
            var formats = buildSupportedFormats(caps || {});
            if (recorder.oncapabilities && formats.length) {
                // Extract device name from track label, if available
                var deviceName = (track && track.label) ? track.label : '';
                recorder.oncapabilities(formats, deviceName);
            }
            capabilitiesReported = true;
        }
        catch (e) {}
    };

    /**
     * The video stream provided by the browser, if allowed. If no stream has
     * yet been received, this will be null.
     *
     * @private
     * @type {MediaStream}
     */
    var mediaStream = null;

    /**
     * Whether camera start/retry attempts should be abandoned.
     *
     * @private
     * @type {boolean}
     */
    var captureStartAborted = false;

    /**
     * Pending timer used for delayed camera-open retries.
     *
     * @private
     * @type {number|null}
     */
    var pendingCaptureRetryTimer = null;

    /**
     * The video encoder instance.
     *
     * @private
     * @type {VideoEncoder}
     */
    var encoder = null;

    /**
     * The media stream track processor.
     *
     * @private
     * @type {MediaStreamTrackProcessor}
     */
    var processor = null;

    /**
     * The readable stream reader.
     *
     * @private
     * @type {ReadableStreamDefaultReader}
     */
    var reader = null;

    /**
     * Parsed AVCC decoder configuration containing length size and parameter sets.
     *
     * @private
     * @type {{ lengthSize: number, sps: Uint8Array[], pps: Uint8Array[] }|null}
     */
    var decoderConfig = null;

    /**
     * Parses an AVCC decoder configuration record to extract lengthSize, SPS, and PPS.
     *
     * @private
     * @param {ArrayBuffer} avcc
     *     The AVCC decoder configuration (decoderConfig.description).
     *
     * @returns {{ lengthSize: number, sps: Uint8Array[], pps: Uint8Array[] }}
     *     Parsed configuration for conversion to Annex B.
     */
    var parseAvccDecoderConfig = function parseAvccDecoderConfig(avcc) {
        var buffer = null;
        var byteOffset = 0;
        var byteLength = 0;

        if (avcc instanceof ArrayBuffer) {
            buffer = avcc;
            byteOffset = 0;
            byteLength = avcc.byteLength;
        }
        else if (ArrayBuffer.isView(avcc) && avcc.buffer instanceof ArrayBuffer) {
            buffer = avcc.buffer;
            byteOffset = avcc.byteOffset || 0;
            byteLength = avcc.byteLength || 0;
        }
        else {
            throw new Error('Unsupported AVCC decoder configuration type');
        }

        var view = new DataView(buffer, byteOffset, byteLength);
        var offset = 0;

        /* configurationVersion, AVCProfileIndication, profile_compatibility, AVCLevelIndication */
        offset += 4;

        /* lengthSizeMinusOne (lower 2 bits) */
        var lengthSizeMinusOne = view.getUint8(offset) & 0x03;
        offset += 1;
        var lengthSize = (lengthSizeMinusOne & 0x03) + 1;

        /* numOfSequenceParameterSets (lower 5 bits) */
        var numSps = view.getUint8(offset) & 0x1F;
        offset += 1;

        var spsList = [];
        for (var i = 0; i < numSps; i++) {
            if (offset + 2 > view.byteLength) break;
            var spsLen = view.getUint16(offset);
            offset += 2;
            if (offset + spsLen > view.byteLength) break;
            spsList.push(new Uint8Array(buffer, byteOffset + offset, spsLen));
            offset += spsLen;
        }

        /* numOfPictureParameterSets */
        var ppsList = [];
        if (offset < view.byteLength) {
            var numPps = view.getUint8(offset);
            offset += 1;
            for (var j = 0; j < numPps; j++) {
                if (offset + 2 > view.byteLength) break;
                var ppsLen = view.getUint16(offset);
                offset += 2;
                if (offset + ppsLen > view.byteLength) break;
                ppsList.push(new Uint8Array(buffer, byteOffset + offset, ppsLen));
                offset += ppsLen;
            }
        }

        var config = { lengthSize: lengthSize, sps: [], pps: [] };
        for (var s = 0; s < spsList.length; s++) {
            var spsCopy = new Uint8Array(spsList[s].length);
            spsCopy.set(spsList[s]);
            config.sps.push(spsCopy);
        }
        for (var p = 0; p < ppsList.length; p++) {
            var ppsCopy = new Uint8Array(ppsList[p].length);
            ppsCopy.set(ppsList[p]);
            config.pps.push(ppsCopy);
        }

        return config;
    };


    /**
     * Whether to force the next frame to be a keyframe.
     *
     * @private
     * @type {boolean}
     */
    var needKeyframe = true;

    /**
     * Interval in milliseconds to request periodic IDR frames.
     *
     * @private
     * @type {number}
     */
    var forceIdrIntervalMs = (typeof window !== 'undefined' && window.GUAC_RDPECAM_FORCE_IDR_MS) ?
            (parseInt(window.GUAC_RDPECAM_FORCE_IDR_MS, 10) || 2000) : 2000;

    /**
     * Backoff delays used for retrying transient camera-open failures.
     *
     * @private
     * @type {!Array.<number>}
     */
    var CAMERA_OPEN_RETRY_DELAYS_MS = [0, 150, 400, 900];

    /**
     * Returns whether the provided getUserMedia() error is likely transient
     * and worth retrying (common on Linux when camera ownership is switching).
     *
     * @private
     * @param {Error|Object} error
     * @returns {boolean}
     */
    var isRetryableCameraOpenError = function isRetryableCameraOpenError(error) {
        if (!error)
            return false;

        var name = error.name || '';
        var message = error.message || '';

        if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError')
            return true;

        return /camera.*in use|device.*busy|could not start video source/i.test(message);
    };

    /**
     * Returns whether the provided getUserMedia() error indicates the current
     * constraints cannot be satisfied and a fallback constraint set should be
     * attempted.
     *
     * @private
     * @param {Error|Object} error
     * @returns {boolean}
     */
    var isConstraintError = function isConstraintError(error) {
        if (!error)
            return false;

        var name = error.name || '';
        return name === 'OverconstrainedError' ||
               name === 'ConstraintNotSatisfiedError' ||
               name === 'NotFoundError' ||
               name === 'NotAllowedError';
    };

    /**
     * Builds camera capture constraint candidates from most specific to most
     * permissive, including Android/HarmonyOS fallbacks.
     *
     * @private
     * @returns {!Array.<(Object|boolean)>}
     */
    var buildCaptureConstraintCandidates = function buildCaptureConstraintCandidates() {
        var candidates = [];
        var seen = {};
        var androidLike = isAndroidLikeBrowser();
        var linuxDesktop = isLinuxDesktopBrowser();
        var conservativeProfile = androidLike || linuxDesktop;

        var pushCandidate = function pushCandidate(videoConstraints) {
            var key = (typeof videoConstraints === 'boolean')
                ? ('bool:' + videoConstraints)
                : JSON.stringify(videoConstraints || {});

            if (seen[key])
                return;

            seen[key] = true;
            candidates.push(videoConstraints);
        };

        var baseVideoConstraints = conservativeProfile ? {
            width: { ideal: format.width, max: format.width },
            height: { ideal: format.height, max: format.height },
            frameRate: { ideal: format.frameRate, max: format.frameRate }
        } : {
            width: format.width,
            height: format.height,
            frameRate: format.frameRate
        };

        if (format.deviceId) {
            try {
                var exactDeviceConstraints = Object.assign({}, baseVideoConstraints, {
                    deviceId: { exact: format.deviceId }
                });
                pushCandidate(exactDeviceConstraints);
            } catch (e) {
                pushCandidate(Object.assign({}, baseVideoConstraints, {
                    deviceId: format.deviceId
                }));
            }

            if (conservativeProfile) {
                pushCandidate(Object.assign({}, baseVideoConstraints, {
                    deviceId: { ideal: format.deviceId }
                }));
            }
        }

        pushCandidate(baseVideoConstraints);

        if (androidLike) {
            pushCandidate({
                width: { ideal: CONSERVATIVE_CLIENT_MAX_WIDTH, max: CONSERVATIVE_CLIENT_MAX_WIDTH },
                height: { ideal: CONSERVATIVE_CLIENT_MAX_HEIGHT, max: CONSERVATIVE_CLIENT_MAX_HEIGHT },
                frameRate: { ideal: CONSERVATIVE_CLIENT_FIXED_FPS, max: CONSERVATIVE_CLIENT_FIXED_FPS }
            });
        }

        // Last-resort fallback when strict constraints fail.
        pushCandidate(true);

        return candidates;
    };

    /**
     * Wall-clock timestamp (ms) of last observed keyframe.
     *
     * Initialize to current time instead of 0 to prevent race condition.
     * If initialized to 0 (epoch), encoding loop may process frame 2 before frame 1's
     * output callback updates lastKeyframeWallMs, causing frame 2 to see stale value
     * and incorrectly request keyframe when checking (Date.now() - 0) >= 2000ms.
     * This prevents consecutive I-frames that Windows Media Foundation decoder rejects.
     *
     * @private
     * @type {number}
     */
    var lastKeyframeWallMs = Date.now();

    /**
     * Marks that the next encoded frame should request a keyframe.
     *
     * @private
     */
    var requireKeyframe = function requireKeyframe() {
        needKeyframe = true;
    };

    /**
     * Marks that a keyframe has just been produced, clearing any outstanding
     * request and updating the periodic IDR timer baseline.
     *
     * @private
     */
    var markKeyframeObserved = function markKeyframeObserved() {
        needKeyframe = false;
        lastKeyframeWallMs = Date.now();
    };

    /**
     * Baseline PTS (in microseconds) for normalizing chunk timestamps to start at 0.
     * Set to the timestamp of the first chunk received after encoding starts.
     *
     * @private
     * @type {number|null}
     */
    var baselinePtsUs = null;

    /**
     * Guacamole.ArrayBufferWriter wrapped around the video output stream
     * provided when this Guacamole.H264CameraRecorder was created.
     *
     * @private
     * @type {!Guacamole.ArrayBufferWriter}
     */
    var writer = new Guacamole.ArrayBufferWriter(stream);

    /**
     * Timer used to monitor source frame cadence and emit repeated frames if
     * input capture stalls temporarily.
     *
     * @private
     * @type {number|null}
     */
    var cadenceWatchdogTimer = null;

    /**
     * Wall-clock timestamp of the last source frame read from the camera
     * track processor.
     *
     * @private
     * @type {number}
     */
    var lastSourceFrameWallMs = 0;

    /**
     * Wall-clock timestamp of the last frame emitted into the Guacamole output
     * stream (real or repeated).
     *
     * @private
     * @type {number}
     */
    var lastOutputFrameWallMs = 0;

    /**
     * Last successfully emitted frame payload.
     *
     * @private
     * @type {Uint8Array|null}
     */
    var lastFramePayload = null;

    /**
     * Last emitted keyframe payload (preferred for repeated keepalive frames).
     *
     * @private
     * @type {Uint8Array|null}
     */
    var lastKeyframePayload = null;

    /**
     * Whether a stall recovery has already been triggered for the current
     * capture session.
     *
     * @private
     * @type {boolean}
     */
    var stallRecoveryTriggered = false;

    /**
     * Builds the RDPECAM frame header.
     *
     * @private
     * @param {Object} params
     *     Parameters for the frame header.
     *
     * @param {boolean} params.keyframe
     *     Whether this is a keyframe.
     *
     * @param {number} params.ptsMs
     *     Presentation timestamp in milliseconds.
     *
     * @param {number} params.payloadLen
     *     Length of the payload in bytes.
     *
     * @returns {ArrayBuffer}
     *     The frame header as ArrayBuffer.
     */
    var buildFrameHeader = function buildFrameHeader(params) {
        var header = new ArrayBuffer(12);
        var view = new DataView(header);
        
        view.setUint8(0, 1); // version
        view.setUint8(1, params.keyframe ? 1 : 0); // flags (bit0: keyframe)
        view.setUint16(2, 0, true); // reserved (little-endian)
        view.setUint32(4, params.ptsMs, true); // pts_ms (little-endian)
        view.setUint32(8, params.payloadLen, true); // payload_len (little-endian)
        
        return header;
    };

    /**
     * Concatenates multiple ArrayBuffers.
     *
     * @private
     * @param {...ArrayBuffer} buffers
     *     The buffers to concatenate.
     *
     * @returns {ArrayBuffer}
     *     The concatenated buffer.
     */
    var concatBuffers = function concatBuffers() {
        var totalLength = 0;
        for (var i = 0; i < arguments.length; i++) {
            totalLength += arguments[i].byteLength;
        }
        
        var result = new Uint8Array(totalLength);
        var offset = 0;
        
        for (var i = 0; i < arguments.length; i++) {
            result.set(new Uint8Array(arguments[i]), offset);
            offset += arguments[i].byteLength;
        }

        return result.buffer;
    };

    /**
     * Returns the expected frame interval based on current target FPS.
     *
     * @private
     * @returns {number}
     */
    var getTargetFrameIntervalMs = function getTargetFrameIntervalMs() {
        var fps = Number(format.frameRate);
        if (!isFinite(fps) || fps <= 0)
            fps = 15;

        return Math.max(50, Math.round(1000 / fps));
    };

    /**
     * Emits a repeated frame (preferably keyframe) with an updated timestamp.
     *
     * @private
     * @param {string} reason
     * @returns {boolean}
     */
    var emitRepeatedFrame = function emitRepeatedFrame(reason) {
        var payload = lastKeyframePayload || lastFramePayload;
        if (!payload || !payload.length)
            return false;

        var payloadSize = payload.length;
        var intervalMs = getTargetFrameIntervalMs();
        var nextPtsMs = (lastOutputPtsMs === null) ? 0 : (lastOutputPtsMs + intervalMs);
        var repeatedAsKeyframe = (payload === lastKeyframePayload);

        var header = buildFrameHeader({
            keyframe: repeatedAsKeyframe,
            ptsMs: nextPtsMs,
            payloadLen: payloadSize
        });

        var payloadBuffer = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payloadSize);
        var frameData = concatBuffers(header, payloadBuffer);
        writer.sendData(frameData);

        lastOutputPtsMs = nextPtsMs;
        lastOutputFrameWallMs = Date.now();

        emitDebugEvent('camera-frame-repeat', {
            reason: reason || 'unspecified',
            ptsMs: nextPtsMs,
            keyframe: repeatedAsKeyframe,
            payloadBytes: payloadSize
        });

        return true;
    };

    /**
     * Stops the frame cadence/stall watchdog timer, if active.
     *
     * @private
     */
    var stopCadenceWatchdog = function stopCadenceWatchdog() {
        if (cadenceWatchdogTimer !== null) {
            clearInterval(cadenceWatchdogTimer);
            cadenceWatchdogTimer = null;
        }
    };

    /**
     * Starts a watchdog that repeats the last frame when output cadence drops
     * and triggers capture restart if the source stalls.
     *
     * @private
     */
    var startCadenceWatchdog = function startCadenceWatchdog() {
        stopCadenceWatchdog();

        if (!(isLinuxDesktopBrowser() || isAndroidLikeBrowser()))
            return;

        stallRecoveryTriggered = false;
        lastSourceFrameWallMs = Date.now();
        lastOutputFrameWallMs = Date.now();

        var pollIntervalMs = Math.max(120, Math.floor(getTargetFrameIntervalMs() / 2));
        cadenceWatchdogTimer = setInterval(function() {
            if (captureStartAborted || !mediaStream || !encoder)
                return;

            var now = Date.now();
            var frameIntervalMs = getTargetFrameIntervalMs();
            var sourceIdleMs = now - lastSourceFrameWallMs;
            var outputIdleMs = now - lastOutputFrameWallMs;

            if (outputIdleMs >= (frameIntervalMs * CADENCE_REPEAT_MULTIPLIER))
                emitRepeatedFrame('output-cadence-gap');

            if (!stallRecoveryTriggered && sourceIdleMs >= CAMERA_STALL_TIMEOUT_MS) {
                stallRecoveryTriggered = true;
                emitDebugEvent('camera-source-stall-detected', {
                    sourceIdleMs: sourceIdleMs,
                    outputIdleMs: outputIdleMs,
                    frameRate: format.frameRate
                });
                streamDenied();
            }
        }, pollIntervalMs);
    };

    /**
     * Returns true if the given payload appears to be Annex-B byte stream
     * format (contains a NAL start code near the beginning).
     *
     * @private
     * @param {!Uint8Array} payload
     * @returns {!boolean}
     */
    var isLikelyAnnexB = function isLikelyAnnexB(payload) {
        if (!payload || payload.length < 4)
            return false;

        var maxScanOffset = Math.min(payload.length - 3, 16);
        for (var i = 0; i < maxScanOffset; i++) {
            if (payload[i] === 0x00 && payload[i + 1] === 0x00) {
                if (payload[i + 2] === 0x01)
                    return true;
                if (i + 3 < payload.length && payload[i + 2] === 0x00 && payload[i + 3] === 0x01)
                    return true;
            }
        }

        return false;
    };

    /**
     * Attempts AVCC->Annex-B conversion using a specific NALU length field
     * size. Returns null if parsing fails.
     *
     * @private
     * @param {!Uint8Array} payload
     * @param {!number} lengthSize
     * @param {!boolean} includeParamSets
     * @returns {Uint8Array|null}
     */
    var avccToAnnexBWithLengthSize = function avccToAnnexBWithLengthSize(payload, lengthSize, includeParamSets) {
        if (!payload || !payload.length || lengthSize < 1 || lengthSize > 4)
            return null;

        var startCode = new Uint8Array([0x00, 0x00, 0x00, 0x01]);
        var outParts = [];

        if (includeParamSets && decoderConfig) {
            var sps = decoderConfig.sps || [];
            var pps = decoderConfig.pps || [];
            for (var s = 0; s < sps.length; s++) {
                outParts.push(startCode);
                outParts.push(sps[s]);
            }
            for (var p = 0; p < pps.length; p++) {
                outParts.push(startCode);
                outParts.push(pps[p]);
            }
        }

        var dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
        var offset = 0;
        var nalCount = 0;

        while (offset + lengthSize <= dv.byteLength) {
            var nalLength = 0;
            for (var i = 0; i < lengthSize; i++)
                nalLength = (nalLength << 8) | dv.getUint8(offset + i);
            offset += lengthSize;

            if (nalLength <= 0)
                continue;

            if (offset + nalLength > dv.byteLength)
                return null;

            outParts.push(startCode);
            outParts.push(new Uint8Array(payload.buffer, payload.byteOffset + offset, nalLength));
            offset += nalLength;
            nalCount++;
        }

        if (!nalCount)
            return null;

        var totalLength = 0;
        for (var part = 0; part < outParts.length; part++)
            totalLength += outParts[part].length;

        var output = new Uint8Array(totalLength);
        var writeOffset = 0;
        for (var idx = 0; idx < outParts.length; idx++) {
            output.set(outParts[idx], writeOffset);
            writeOffset += outParts[idx].length;
        }

        return output;
    };

    /**
     * Normalizes encoded H.264 payload into Annex-B format. This supports
     * browsers that emit either Annex-B directly or AVCC with varying NALU
     * length field sizes.
     *
     * @private
     * @param {!Uint8Array} chunkData
     * @param {!boolean} isKeyframe
     * @returns {Uint8Array|null}
     */
    var normalizePayloadToAnnexB = function normalizePayloadToAnnexB(chunkData, isKeyframe) {
        if (!chunkData || !chunkData.length)
            return null;

        // Some Chrome/Linux stacks emit Annex-B directly.
        if (isLikelyAnnexB(chunkData))
            return chunkData;

        // First use the existing converter with decoder configuration, if any.
        var converted = Guacamole.H264AnnexBUtil.avccToAnnexB(chunkData, isKeyframe, decoderConfig);
        if (converted && converted.length)
            return converted;

        // If decoder config metadata is absent/incomplete, probe common AVCC
        // length sizes used by browser encoders.
        var tried = {};
        var candidateSizes = [];
        if (decoderConfig && decoderConfig.lengthSize)
            candidateSizes.push(decoderConfig.lengthSize);
        candidateSizes.push(4, 2, 1);

        for (var i = 0; i < candidateSizes.length; i++) {
            var lenSize = candidateSizes[i];
            if (tried[lenSize])
                continue;
            tried[lenSize] = true;

            converted = avccToAnnexBWithLengthSize(chunkData, lenSize, isKeyframe);
            if (converted && converted.length)
                return converted;
        }

        return null;
    };

    /**
     * Selects an H.264 level ID based on capture resolution.
     *
     * @private
     */
    var selectLevelIdcHex = function selectLevelIdcHex(width, height) {
        var mbW = Math.ceil((width || 0) / 16);
        var mbH = Math.ceil((height || 0) / 16);
        var mbPerFrame = mbW * mbH;
        if (mbPerFrame <= 1620) return '1E';   // Level 3.0
        if (mbPerFrame <= 3600) return '1F';   // Level 3.1
        if (mbPerFrame <= 8192) return '28';   // Level 4.0
        return '29';                            // Level 4.1 fallback
    };

    /**
     * Returns the target bitrate for the current format.
     *
     * @private
     */
    var getTargetBitrate = function getTargetBitrate() {
        if (format.height >= 1080) return 2700000;  // 2.7 Mbps for 1080p
        if (format.height >= 720)  return 1250000;  // 1.25 Mbps for 720p
        if (format.height >= 480)  return 700000;   // 700 kbps for 480p
        if (format.height >= 360)  return 400000;   // 400 kbps for 360p
        if (format.height >= 240)  return 170000;   // 170 kbps for 240p
        return 100000;                               // 100 kbps for lower resolutions
    };

    /**
     * Builds candidate encoder configs in compatibility order. Baseline
     * profile and Annex-B are prioritized for interoperability.
     *
     * @private
     * @returns {!Array.<Object>}
     */
    var buildEncoderConfigCandidates = function buildEncoderConfigCandidates() {
        var level = selectLevelIdcHex(format.width, format.height);
        var targetBitrate = getTargetBitrate();
        var codecPrefixes = ['avc1.42E0', 'avc1.4D40', 'avc1.6400'];
        var avcFormats = ['annexb', 'avc'];
        var accelerationModes = isAndroidLikeBrowser()
            ? ['prefer-software', 'prefer-hardware', null]
            : ['prefer-hardware', 'prefer-software', null];
        var candidates = [];

        for (var c = 0; c < codecPrefixes.length; c++) {
            var codecString = codecPrefixes[c] + level;
            for (var f = 0; f < avcFormats.length; f++) {
                for (var a = 0; a < accelerationModes.length; a++) {
                    var candidate = {
                        codec: codecString,
                        width: format.width,
                        height: format.height,
                        framerate: format.frameRate,
                        latencyMode: 'realtime',
                        bitrate: targetBitrate,
                        bitrateMode: 'variable',
                        avc: { format: avcFormats[f] }
                    };

                    if (accelerationModes[a])
                        candidate.hardwareAcceleration = accelerationModes[a];

                    candidates.push(candidate);
                }
            }
        }

        return candidates;
    };

    /**
     * Configures the active VideoEncoder using the first supported H.264
     * candidate configuration.
     *
     * @private
     * @returns {Promise<!Object>}
     */
    var configureEncoderWithFallback = function configureEncoderWithFallback() {
        var candidates = buildEncoderConfigCandidates();
        var index = 0;

        var tryNext = function tryNext() {
            if (index >= candidates.length)
                return Promise.reject(new Error('No supported H.264 encoder configuration found'));

            var candidate = candidates[index++];
            var probe = Promise.resolve({ supported: true, config: candidate });

            if (typeof VideoEncoder.isConfigSupported === 'function')
                probe = VideoEncoder.isConfigSupported(candidate);

            return probe.then(function(support) {
                if (!support || !support.supported)
                    throw new Error('Unsupported encoder config');

                var effectiveConfig = support.config || candidate;
                encoder.configure(effectiveConfig);
                emitDebugEvent('encoder-config-selected', {
                    codec: effectiveConfig.codec,
                    width: effectiveConfig.width,
                    height: effectiveConfig.height,
                    framerate: effectiveConfig.framerate,
                    hardwareAcceleration: effectiveConfig.hardwareAcceleration || null,
                    avcFormat: effectiveConfig.avc && effectiveConfig.avc.format
                        ? effectiveConfig.avc.format
                        : null
                });
                return effectiveConfig;
            }).catch(function() {
                return tryNext();
            });
        };

        return tryNext();
    };

    /**
     * getUserMedia() callback which handles successful retrieval of a
     * video stream (successful start of recording).
     *
     * @private
     * @param {!MediaStream} stream
     *     A MediaStream which provides access to video data read from the
     *     user's local camera device.
     */
    var streamReceived = function streamReceived(stream) {
        if (captureStartAborted) {
            try {
                stream.getTracks().forEach(function(track) { track.stop(); });
            } catch (e) {}
            return;
        }

        var track = null;

        // Save stream early so cleanup paths can always stop tracks.
        mediaStream = stream;
        decoderConfig = null;

        // Create video encoder
        encoder = new VideoEncoder({
            output: function(chunk, meta) {
                if (meta && meta.decoderConfig && meta.decoderConfig.description) {
                    try {
                        decoderConfig = parseAvccDecoderConfig(meta.decoderConfig.description);
                    }
                    catch (e) {
                        // Some Chromium/Linux builds expose description as a
                        // different BufferSource shape; tolerate parse failure
                        // and continue with fallback conversion paths.
                    }
                }

                if (chunk.type === 'key')
                    markKeyframeObserved();

                var chunkData = new Uint8Array(chunk.byteLength);
                chunk.copyTo(chunkData);

                var payload = normalizePayloadToAnnexB(chunkData, chunk.type === 'key');
                if (!payload || payload.length === 0)
                    return;

                var payloadSize = payload.length;
                if (!payloadSize)
                    return;

                if (baselinePtsUs === null)
                    baselinePtsUs = chunk.timestamp;

                var relativePtsUs = chunk.timestamp - baselinePtsUs;
                var relativePtsMs = Math.max(0, Math.round(relativePtsUs / 1000));

                if (lastOutputPtsMs !== null && relativePtsMs < lastOutputPtsMs)
                    relativePtsMs = lastOutputPtsMs;

                lastOutputPtsMs = relativePtsMs;
                lastOutputFrameWallMs = Date.now();

                var header = buildFrameHeader({
                    keyframe: chunk.type === 'key',
                    ptsMs: relativePtsMs,
                    payloadLen: payloadSize
                });

                var payloadCopy = new Uint8Array(payloadSize);
                payloadCopy.set(payload);
                lastFramePayload = payloadCopy;
                if (chunk.type === 'key')
                    lastKeyframePayload = payloadCopy;

                var payloadBuffer = payloadCopy.buffer.slice(payloadCopy.byteOffset, payloadCopy.byteOffset + payloadSize);
                var frameData = concatBuffers(header, payloadBuffer);
                writer.sendData(frameData);
            },
            error: function(error) {
                emitDebugEvent('encoder-runtime-error', {
                    name: error && error.name ? error.name : '',
                    message: error && error.message ? error.message : ''
                });
                streamDenied();
            }
        });

        configureEncoderWithFallback().then(function() {
            track = stream.getVideoTracks()[0];
            if (!track)
                throw new Error('Camera stream has no video track');

            var settings = {};
            if (track && typeof track.getSettings === 'function') {
                try {
                    var rawSettings = track.getSettings() || {};
                    settings = {
                        width: rawSettings.width || null,
                        height: rawSettings.height || null,
                        frameRate: rawSettings.frameRate || null,
                        deviceId: rawSettings.deviceId || null
                    };
                }
                catch (e) {}
            }

            emitDebugEvent('camera-open-success', {
                label: (track && track.label) ? track.label : '',
                settings: settings,
                requestedFormat: {
                    width: format.width,
                    height: format.height,
                    frameRate: format.frameRate,
                    deviceId: format.deviceId || null
                }
            });

            reportCapabilities(track);
            processor = new MediaStreamTrackProcessor({ track: track });
            reader = processor.readable.getReader();
            lastSourceFrameWallMs = Date.now();
            lastOutputFrameWallMs = Date.now();
            startCadenceWatchdog();

            // Start encoding loop
            (async function() {
                while (true) {
                    var result = await reader.read();
                    if (result.done)
                        break;

                    lastSourceFrameWallMs = Date.now();
                    var wantPeriodicIdr = (Date.now() - lastKeyframeWallMs) >= forceIdrIntervalMs;
                    var requestKey = needKeyframe || wantPeriodicIdr;
                    encoder.encode(result.value, { keyFrame: !!requestKey });
                    result.value.close();
                }
            })();
        }).catch(function(error) {
            emitDebugEvent('camera-capture-start-failed', {
                name: error && error.name ? error.name : '',
                message: error && error.message ? error.message : ''
            });
            streamDenied();
        });

    };

    /**
     * getUserMedia() callback which handles camera recording denial. The
     * underlying Guacamole output stream is closed, and the failure to
     * record is noted using onerror.
     *
     * @private
     */
    var streamDenied = function streamDenied() {
        captureStartAborted = true;
        stopCadenceWatchdog();
        if (pendingCaptureRetryTimer !== null) {
            clearTimeout(pendingCaptureRetryTimer);
            pendingCaptureRetryTimer = null;
        }

        emitDebugEvent('camera-stream-denied', {
            requestedFormat: {
                width: format.width,
                height: format.height,
                frameRate: format.frameRate,
                deviceId: format.deviceId || null
            }
        });

        try { if (reader && reader.cancel) reader.cancel(); } catch (e) {}
        try { if (reader && reader.releaseLock) reader.releaseLock(); } catch (e) {}
        try { if (encoder && encoder.flush) encoder.flush(); } catch (e) {}
        try { if (encoder && encoder.close) encoder.close(); } catch (e) {}

        if (mediaStream) {
            try {
                var tracks = mediaStream.getTracks();
                for (var i = 0; i < tracks.length; i++)
                    tracks[i].stop();
            } catch (e) {}
        }

        processor = null;
        reader = null;
        encoder = null;
        mediaStream = null;
        decoderConfig = null;
        baselinePtsUs = null;
        lastOutputPtsMs = null;
        lastSourceFrameWallMs = 0;
        lastOutputFrameWallMs = 0;
        lastFramePayload = null;
        lastKeyframePayload = null;
        stallRecoveryTriggered = false;
        requireKeyframe();
        lastKeyframeWallMs = Date.now();

        // Simply end stream if camera access is not allowed
        writer.sendEnd();

        // Notify of closure
        if (recorder.onerror)
            recorder.onerror();

    };

    /**
     * Requests access to the user's camera and begins capturing video. All
     * received video data is encoded as H.264 and forwarded to the
     * Guacamole stream underlying this Guacamole.H264CameraRecorder. This
     * function must be invoked ONLY ONCE per instance of
     * Guacamole.H264CameraRecorder.
     *
     * @private
     */
    var beginVideoCapture = function beginVideoCapture() {
        captureStartAborted = false;
        if (pendingCaptureRetryTimer !== null) {
            clearTimeout(pendingCaptureRetryTimer);
            pendingCaptureRetryTimer = null;
        }

        var constraintCandidates = buildCaptureConstraintCandidates();

        var tryOpenCamera = function tryOpenCamera(attempt, constraintIndex) {
            if (captureStartAborted)
                return;

            var index = constraintIndex || 0;
            if (index >= constraintCandidates.length) {
                streamDenied();
                return;
            }

            emitDebugEvent('camera-open-attempt', {
                attempt: attempt,
                constraintIndex: index,
                constraints: sanitizeConstraintsForDebug(constraintCandidates[index]),
                userAgent: getUserAgentString()
            });

            var promise = navigator.mediaDevices.getUserMedia({
                'video': constraintCandidates[index]
            });

            if (promise && promise.then) {
                promise.then(streamReceived, function(error) {
                    if (captureStartAborted)
                        return;

                    emitDebugEvent('camera-open-error', {
                        attempt: attempt,
                        constraintIndex: index,
                        constraints: sanitizeConstraintsForDebug(constraintCandidates[index]),
                        name: error && error.name ? error.name : '',
                        message: error && error.message ? error.message : ''
                    });

                    if (isConstraintError(error) && (index + 1) < constraintCandidates.length) {
                        emitDebugEvent('camera-open-fallback-constraint', {
                            fromConstraintIndex: index,
                            toConstraintIndex: index + 1
                        });
                        tryOpenCamera(0, index + 1);
                        return;
                    }

                    var nextAttempt = attempt + 1;
                    if (isRetryableCameraOpenError(error) &&
                            nextAttempt < CAMERA_OPEN_RETRY_DELAYS_MS.length) {
                        emitDebugEvent('camera-open-retry-scheduled', {
                            retryAttempt: nextAttempt,
                            retryDelayMs: CAMERA_OPEN_RETRY_DELAYS_MS[nextAttempt],
                            constraintIndex: index
                        });
                        pendingCaptureRetryTimer = setTimeout(function() {
                            pendingCaptureRetryTimer = null;
                            tryOpenCamera(nextAttempt, index);
                        }, CAMERA_OPEN_RETRY_DELAYS_MS[nextAttempt]);
                        return;
                    }

                    if ((index + 1) < constraintCandidates.length) {
                        emitDebugEvent('camera-open-fallback-next', {
                            fromConstraintIndex: index,
                            toConstraintIndex: index + 1
                        });
                        tryOpenCamera(0, index + 1);
                        return;
                    }

                    streamDenied();
                });
            }
        };

        tryOpenCamera(0, 0);

    };

    /**
     * Stops capturing video, if the capture has started, freeing all associated
     * resources. If the capture has not started, this function simply ends the
     * underlying Guacamole stream.
     *
     * @private
     */
    var stopVideoCapture = function stopVideoCapture() {
        captureStartAborted = true;
        stopCadenceWatchdog();
        if (pendingCaptureRetryTimer !== null) {
            clearTimeout(pendingCaptureRetryTimer);
            pendingCaptureRetryTimer = null;
        }

        emitDebugEvent('camera-stop-local', {});

        // Attempt graceful shutdown in order: reader, encoder, tracks
        try { if (reader && reader.cancel) reader.cancel(); } catch (e) {}
        try { if (reader && reader.releaseLock) reader.releaseLock(); } catch (e) {}
        try { if (encoder && encoder.flush) encoder.flush(); } catch (e) {}
        try { if (encoder && encoder.close) encoder.close(); } catch (e) {}

        // Reset PTS baseline and frame tracking so next encoding session starts fresh
        baselinePtsUs = null;
        
        lastOutputPtsMs = null;
        lastSourceFrameWallMs = 0;
        lastOutputFrameWallMs = 0;
        lastFramePayload = null;
        lastKeyframePayload = null;
        stallRecoveryTriggered = false;
        requireKeyframe();
        lastKeyframeWallMs = Date.now();

        // Stop capture
        if (mediaStream) {
            try {
                var tracks = mediaStream.getTracks();
                for (var i = 0; i < tracks.length; i++)
                    tracks[i].stop();
            } catch (e) {}
        }

        // Remove references to now-unneeded components
        processor = null;
        reader = null;
        encoder = null;
        mediaStream = null;

        // End stream
        writer.sendEnd();

    };

    
    /**
     * Resets timing state so the next encoded frame becomes the new baseline.
     */
    this.resetTimeline = function resetTimeline() {
        baselinePtsUs = null;
        lastOutputPtsMs = null;
        lastSourceFrameWallMs = Date.now();
        lastOutputFrameWallMs = Date.now();
        
        requireKeyframe();
    };

    /**
     * Updates desired capture format (width/height/frameRate).
     *
     * @param {Object} c
     *     Optional constraints to override the current format.
     * @param {number} [c.width]
     *     Override width in pixels.
     * @param {number} [c.height]
     *     Override height in pixels.
     * @param {number} [c.frameRate]
     *     Override frame rate (frames per second).
     */
    this.setFormat = function setFormat(c) {
        if (!c) return;

        var linuxDesktop = isLinuxDesktopBrowser();
        var androidLike = isAndroidLikeBrowser();
        var conservativeProfile = linuxDesktop || androidLike;

        if (typeof c.width === 'number')  format.width  = c.width;
        if (typeof c.height === 'number') format.height = c.height;

        if (conservativeProfile) {
            // Keep Linux/Android/HarmonyOS constraints conservative to improve
            // camera and encoder startup reliability.
            if (typeof format.width === 'number')
                format.width = Math.min(format.width, CONSERVATIVE_CLIENT_MAX_WIDTH);
            if (typeof format.height === 'number')
                format.height = Math.min(format.height, CONSERVATIVE_CLIENT_MAX_HEIGHT);
        }

        if (typeof c.frameRate === 'number') {
            var targetFrameRate = c.frameRate;

            format.frameRate = targetFrameRate;
        }

        if (conservativeProfile)
            format.frameRate = CONSERVATIVE_CLIENT_FIXED_FPS;

        if (c.deviceId) format.deviceId = c.deviceId;
    };
    /**
     * Starts the camera recording process.
     */
    this.start = function start() {
        if (!mediaStream) {
            beginVideoCapture();
        }
    };

    /**
     * Stops the camera recording process.
     */
    this.stop = function stop() {
        stopVideoCapture();
    };

};

Guacamole.H264CameraRecorder.prototype = new Guacamole.CameraRecorder();

/**
 * Determines whether the given mimetype is supported by
 * Guacamole.H264CameraRecorder.
 *
 * @param {!string} mimetype
 *     The mimetype to check.
 *
 * @returns {!boolean}
 *     true if the given mimetype is supported by Guacamole.H264CameraRecorder,
 *     false otherwise.
 */
Guacamole.H264CameraRecorder.isSupportedType = function isSupportedType(mimetype) {

    // Check for WebCodecs support
    if (!window.VideoEncoder || !window.MediaStreamTrackProcessor)
        return false;

    return mimetype === 'application/rdpecam+h264';

};

/**
 * Returns a list of all mimetypes supported by Guacamole.H264CameraRecorder.
 *
 * @returns {!string[]}
 *     A list of all mimetypes supported by Guacamole.H264CameraRecorder.
 */
Guacamole.H264CameraRecorder.getSupportedTypes = function getSupportedTypes() {

    // Check for WebCodecs support
    if (!window.VideoEncoder || !window.MediaStreamTrackProcessor)
        return [];

    return ['application/rdpecam+h264'];

};
