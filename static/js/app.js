// ── Tab Switcher ─────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  if (tab !== 'webcam') stopWebcam();
}

// ── Drag & Drop / File Preview ────────────────────────────────────────────────
const fileInput  = document.getElementById('file-input');
const dropZone   = document.getElementById('drop-zone');
const previewImg = document.getElementById('preview-img');
const dropInner  = document.getElementById('drop-inner');

if (fileInput) {
  fileInput.addEventListener('change', () => showPreview(fileInput.files[0]));
}

if (dropZone) {
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) { fileInput.files = e.dataTransfer.files; showPreview(file); }
  });
}

function showPreview(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    previewImg.classList.remove('hidden');
    dropInner.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

// ── Webcam Detection ──────────────────────────────────────────────────────────
let stream      = null;
let intervalId  = null;
const video     = document.getElementById('webcam-video');
const canvas    = document.getElementById('webcam-canvas');
const overlay   = document.getElementById('webcam-overlay');
const liveResult= document.getElementById('live-result');
const startBtn  = document.getElementById('start-btn');
const stopBtn   = document.getElementById('stop-btn');

async function startWebcam() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    overlay.style.display = 'none';
    startBtn.disabled = true;
    stopBtn.disabled  = false;
    intervalId = setInterval(captureAndPredict, 1500);
  } catch (err) {
    alert('Could not access webcam: ' + err.message);
  }
}

function stopWebcam() {
  if (stream)     { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (video)      video.srcObject = null;
  if (overlay)    overlay.style.display = '';
  if (liveResult) liveResult.classList.add('hidden');
  if (startBtn)   startBtn.disabled = false;
  if (stopBtn)    stopBtn.disabled  = true;
}

async function captureAndPredict() {
  if (!video || !canvas) return;
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

  try {
    // WEBCAM_URL is injected in index.html from Flask's url_for
    const res  = await fetch(WEBCAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    });
    const data = await res.json();
    if (data.error) return;

    liveResult.classList.remove('hidden');
    liveResult.className = 'live-result ' + data.css_class;
    document.getElementById('live-icon').textContent  = data.icon;
    document.getElementById('live-label').textContent = data.label;
    document.getElementById('live-conf').textContent  = data.confidence.toFixed(1) + '%';
  } catch (e) {
    console.error('Webcam predict error:', e);
  }
}
