const form = document.querySelector('#upload-form');
const input = document.querySelector('#video-input');
const dropzone = document.querySelector('#dropzone');
const analyzeButton = document.querySelector('#analyze-button');
const previewWrap = document.querySelector('#preview-wrap');
const videoPreview = document.querySelector('#video-preview');
const fileSize = document.querySelector('#file-size');
const emptyState = document.querySelector('#empty-state');
const loadingState = document.querySelector('#loading-state');
const resultState = document.querySelector('#result-state');
const errorMessage = document.querySelector('#error-message');
const statusDot = document.querySelector('#status-dot');
const progressLabel = document.querySelector('#progress-label');
const progressBar = document.querySelector('#progress-bar');
const liveFrameCount = document.querySelector('#live-frame-count');
const liveEvent = document.querySelector('#live-event');
let selectedFile = null;
let previewUrl = null;
let pollTimer = null;

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function chooseFile(file) {
  if (!file || !file.type.startsWith('video/')) {
    showError('Please choose a video file.');
    return;
  }
  selectedFile = file;
  analyzeButton.disabled = false;
  dropzone.querySelector('.drop-title').textContent = file.name;
  dropzone.querySelector('.drop-copy').textContent = 'Ready to analyze';
  fileSize.textContent = formatBytes(file.size);
  previewWrap.hidden = false;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  videoPreview.src = previewUrl;
  hideError();
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  statusDot.className = 'status-dot';
}

function hideError() {
  errorMessage.hidden = true;
}

function setView(view) {
  emptyState.hidden = view !== 'empty';
  loadingState.hidden = view !== 'loading';
  resultState.hidden = view !== 'result';
  statusDot.className = view === 'loading' ? 'status-dot' : 'status-dot idle';
}

function renderEvents(events) {
  const container = document.querySelector('#events');
  if (!events.length) {
    container.innerHTML = '<p class="muted">No events recorded.</p>';
    return;
  }
  container.innerHTML = events.map((event) => {
    const label = event.status === 'confirmed_fall'
      ? 'Confirmed fall'
      : event.status === 'false_alarm'
        ? 'False alarm'
        : 'Fall pattern flagged';
    const className = event.status === 'confirmed_fall' ? 'event confirmed' : 'event';
    return `<div class="${className}"><strong>${label}</strong><time>${event.seconds.toFixed(2)}s</time></div>`;
  }).join('');
}

function renderLiveEvents(events) {
  const container = document.querySelector('#live-events');
  if (!events.length) return;
  container.innerHTML = events.map((event) => {
    const label = event.status === 'confirmed_fall'
      ? 'Confirmed fall'
      : event.status === 'false_alarm'
        ? 'False alarm'
        : 'Fall pattern flagged';
    const className = event.status === 'confirmed_fall' ? 'event confirmed' : 'event';
    return `<div class="${className}"><strong>${label}</strong><time>${event.seconds.toFixed(2)}s</time></div>`;
  }).join('');
}

function updateProgress(data) {
  const total = data.total_frames || 0;
  const processed = data.processed_frames || 0;
  const percent = total ? Math.min(100, (processed / total) * 100) : 8;
  progressBar.style.width = `${percent}%`;
  liveFrameCount.textContent = total
    ? `${processed.toLocaleString()} / ${total.toLocaleString()} frames`
    : 'Preparing video...';
  if (data.latest_event) {
    const event = data.latest_event;
    liveEvent.textContent = event.status === 'confirmed_fall'
      ? `Confirmed fall at ${event.seconds.toFixed(2)}s`
      : event.status === 'false_alarm'
        ? `False alarm at ${event.seconds.toFixed(2)}s`
        : `Pattern flagged at ${event.seconds.toFixed(2)}s`;
  }
  if (data.events) {
    renderEvents(data.events);
    renderLiveEvents(data.events);
  }
  progressLabel.textContent = data.status === 'queued'
    ? 'Starting the video analysis...'
    : 'Reading frames and tracking pose...';
}

function renderResult(data) {
  const frames = data.frames ?? data.processed_frames ?? 0;
  document.querySelector('#summary').textContent = data.summary;
  document.querySelector('#confirmed-count').textContent = data.confirmed_falls;
  document.querySelector('#frame-count').textContent = frames.toLocaleString();
  document.querySelector('#duration').textContent = `${data.duration_seconds ?? 0}s`;
  renderEvents(data.events);
  setView('result');
}

dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') input.click();
});
dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragging');
  chooseFile(event.dataTransfer.files[0]);
});
input.addEventListener('change', () => chooseFile(input.files[0]));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedFile) return;
  const formData = new FormData();
  formData.append('video', selectedFile);
  analyzeButton.disabled = true;
  analyzeButton.querySelector('span').textContent = 'Analyzing...';
  hideError();
  setView('loading');
  progressBar.style.width = '2%';
  liveFrameCount.textContent = 'Uploading video...';
  liveEvent.textContent = 'No event yet';
  document.querySelector('#live-events').innerHTML = '<p class="muted">Analysis events will appear here.</p>';
  try {
    const response = await fetch('/api/analyze', { method: 'POST', body: formData });
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || 'Analysis failed.');
    await watchJob(job.job_id);
  } catch (error) {
    setView('empty');
    showError(error.message);
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.querySelector('span').textContent = 'Analyze video';
  }
});

function watchJob(jobId) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not read analysis progress.');
        updateProgress(data);
        if (data.status === 'completed') {
          renderResult(data);
          resolve(data);
          return;
        }
        if (data.status === 'failed') {
          reject(new Error(data.error || 'Analysis failed.'));
          return;
        }
        pollTimer = window.setTimeout(poll, 400);
      } catch (error) {
        reject(error);
      }
    };
    poll();
  });
}
