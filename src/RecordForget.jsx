import React, { useState, useRef, useEffect } from "react";
import UnifiedGraph from "./components/UnifiedGraph";
import "./RecordForget.css";

function RecordForget() {
  const [recording, setRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusText, setStatusText] = useState("Tap to start recording");
  const [zoomH, setZoomH] = useState(1); // horizontal zoom
  const [sessionId, setSessionId] = useState(0); // to reset graph per recording

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  const playbackAudioRef = useRef(null);

  const handleButtonClick = async () => {
    setErrorMsg("");

    // 1) If currently recording → stop & then playback will start automatically
    if (recording) {
      stopRecording();
      return;
    }

    // 2) If currently playing → stop playback and start new recording
    if (isPlaying) {
      stopPlayback();
      await startRecording();
      return;
    }

    // 3) Not recording, not playing, but have an old audio → delete and start new recording
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
      await startRecording();
      return;
    }

    // 4) First ever click → start recording
    await startRecording();
  };

  const startRecording = async () => {
    try{
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg("Your browser does not support audio recording.");
        return;
      }

      // Stop any existing playback + audio graph
      stopPlayback();
      teardownAudioGraph();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        // Build in-memory audio
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);

        // We are done with mic context; playback will use its own context
        teardownAudioGraph();

        // Start playback with new URL
        startPlayback(url);
      };

      mediaRecorder.start();
      setRecording(true);
      setIsPlaying(false);
      setStatusText("Recording... tap to stop and play");
      setSessionId((prev) => prev + 1); // reset graph history for new session
    } catch (error) {
      console.error(error);
      setErrorMsg("Microphone access denied or unavailable.");
      teardownAudioGraph();
      stopStream();
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.error(e);
    }
    setRecording(false);
    setStatusText("Stopping... preparing playback");
    stopStream();
    // audio graph for mic closed in onstop
  };

  const startPlayback = (url) => {
    // Stop previous playback if any
    stopPlayback();
    teardownAudioGraph();

    const audio = new Audio(url);
    playbackAudioRef.current = audio;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    const source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    audio.onended = () => {
      setIsPlaying(false);
      setStatusText("Playback finished. Tap to record again.");
      teardownAudioGraph();
    };

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setStatusText("Playing your last recording");
      })
      .catch((err) => {
        console.error(err);
        setIsPlaying(false);
        setStatusText("Tap to play or record again");
      });
  };

  const stopPlayback = () => {
    if (playbackAudioRef.current) {
      try {
        playbackAudioRef.current.pause();
        playbackAudioRef.current.currentTime = 0;
      } catch (e) {
        console.error(e);
      }
      playbackAudioRef.current.onended = null;
      playbackAudioRef.current = null;
    }
    setIsPlaying(false);
    teardownAudioGraph();
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const teardownAudioGraph = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const cleanupAll = () => {
    stopPlayback();
    stopStream();
    teardownAudioGraph();
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
    }
  };

  useEffect(() => {
    return () => {
      cleanupAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, []);

  const getButtonLabel = () => {
    if (recording) return "Stop & Play";
    if (isPlaying) return "Stop & Record New";
    if (audioURL) return "Record Again";
    return "Start Recording";
  };

  const isGraphActive = recording || isPlaying;

  return (
    <div className="rf-root">
      <div className="rf-layout">
    

        {/* TOP: Graph area (~70% height) */}
        <section className="rf-graph-section">
          <UnifiedGraph
            analyser={analyserRef.current}
            audioContext={audioContextRef.current}
            isActive={isGraphActive}
            sessionId={sessionId}
            zoomH={zoomH}
          />
          <div className="rf-status-row">
            <span className="rf-status-text">{statusText}</span>
            <div className="rf-zoom-control">
              <label>
                Zoom (time)
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={zoomH}
                  onChange={(e) => setZoomH(parseFloat(e.target.value))}
                />
              </label>
            </div>
          </div>
        </section>

        {/* MIDDLE: Single button */}
        <section className="rf-button-section">
          <button
            className={`rf-button ${recording ? "rf-button-recording" : ""}`}
            onClick={handleButtonClick}
          >
            {getButtonLabel()}
          </button>
          {errorMsg && <p className="rf-error">{errorMsg}</p>}
        </section>

        {/* BOTTOM: Info (scrollable only inside this box) */}
        <section className="rf-info-section">
          <div className="rf-info-scroll">
            <h2>How RecordForget works</h2>
            <ul>
              <li><strong>1st tap:</strong> Start recording</li>
              <li><strong>2nd tap:</strong> Stop and play that recording</li>
              <li><strong>3rd tap:</strong> Stop playback, delete old audio, and start a new recording</li>
            </ul>
            <h3>Pitch graph (C1–C6)</h3>
            <p>
              The main line shows your pitch over time, mapped to musical notes from C1 to C6.
              Use the zoom slider to see more or less history, and drag horizontally on the graph
              to pan through your performance.
            </p>
            <h3>Intensity (loudness)</h3>
            <p>
              The smaller line at the bottom shows your intensity (RMS loudness). It helps you
              see how stable or dynamic your volume is while you speak or sing.
            </p>
            <h3>Zoom & pan</h3>
            <ul>
              <li><strong>Horizontal zoom:</strong> use the slider named “Zoom (time)”</li>
              <li><strong>Horizontal pan:</strong> drag left / right on the graph</li>
              <li><strong>Vertical zoom:</strong> use trackpad pinch / mouse wheel over the graph</li>
            </ul>
            <p className="rf-note">
              All audio stays in memory only. When you refresh or close the tab, everything is gone.
              This is made for self-communication and singing practice — record, listen, learn, and forget.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default RecordForget;
