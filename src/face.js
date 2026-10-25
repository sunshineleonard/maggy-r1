// Maggy head tracking (loaded only when the user turns it on). Front camera at low resolution + MediaPipe face detector.
// Calls onFace(x, y) about 12 times a second: x,y in -1..1, already turned into "where your head is" from Maggy's side
// (move your head right -> x goes positive; move it down -> y goes negative).
import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";

let video = null, stream = null, detector = null, timer = 0, running = false;

async function start({ base, model, onFace, onStatus }) {
  running = true;
  onStatus("camera…");
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 160 }, height: { ideal: 120 }, frameRate: { ideal: 15 } }, audio: false });
  if (!running) { stop(); return; }
  video = document.createElement("video"); video.muted = true; video.playsInline = true; video.setAttribute("playsinline", "");
  video.srcObject = stream; await video.play();
  if (!detector) {
    onStatus("loading face finder…");
    const files = await FilesetResolver.forVisionTasks(base);
    detector = await FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: model, delegate: "CPU" }, runningMode: "VIDEO", minDetectionConfidence: .5 });
  }
  if (!running) { stop(); return; }
  onStatus("on");
  let frames = 0, t0 = performance.now(), lastTs = -1;
  const loop = () => {
    if (!running) return;
    const ts = performance.now();
    if (video.readyState >= 2 && ts > lastTs) {
      lastTs = ts;
      try {
        const r = detector.detectForVideo(video, ts), d = r.detections && r.detections[0];
        if (d && d.boundingBox && video.videoWidth) {
          const b = d.boundingBox, cx = (b.originX + b.width / 2) / video.videoWidth, cy = (b.originY + b.height / 2) / video.videoHeight;
          onFace((.5 - cx) * 2, (.5 - cy) * 2);
        }
      } catch (e) { onStatus("error " + (e.message || e)); }
      frames++;
      if (ts - t0 > 3000) { onStatus("on · " + Math.round(frames * 1000 / (ts - t0)) + " fps"); frames = 0; t0 = ts; }
    }
    timer = setTimeout(loop, 80);   // ~12 checks a second is plenty for a smooth, cheap parallax
  };
  loop();
}

function stop() {
  running = false; clearTimeout(timer);
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; if (video) { video.srcObject = null; video = null; }
}

window.MaggyFace = { start, stop };
