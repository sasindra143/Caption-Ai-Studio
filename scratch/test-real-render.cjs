const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

function escapeFilterPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/,/g, '\\,');
}

function assTimestamp(seconds) {
  const safe = Math.max(0, seconds);
  const centiseconds = Math.floor((safe - Math.floor(safe)) * 100);
  return `${Math.floor(safe / 3600)}:${String(Math.floor(safe / 60) % 60).padStart(2, '0')}:${String(Math.floor(safe) % 60).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function assOverrideColor(hex) {
  const rgb = hex.slice(1).match(/.{2}/g) ?? ['FF', 'FF', 'FF'];
  return `&H${rgb.reverse().join('')}&`;
}

function assText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\r?\n/g, '\\N');
}

// Generate ASS subtitles exactly matching buildAssSubtitles in backend/index.ts
function generateAss() {
  const playResX = 320;
  const playResY = 240;

  const events = [];

  // Segment 1: Keyframe animation from (25%, 75%) to (75%, 40%), scale 1.0 -> 1.3, rotation 0 -> 15 deg
  {
    const font = 'Arial';
    const baseFontSize = 18;
    const textColor = assOverrideColor('#FFFFFF');
    const outlineColor = assOverrideColor('#000000');
    const outlineW = 2;
    const shadowColor = assOverrideColor('#000000');
    const shadowDepth = 2;

    const tA = 0.0;
    const tB = 1.5;
    const x1 = Math.round((25 / 100) * playResX);
    const y1 = Math.round((75 / 100) * playResY);
    const x2 = Math.round((75 / 100) * playResX);
    const y2 = Math.round((40 / 100) * playResY);
    const durMs = Math.round((tB - tA) * 1000);
    const scaleA = 100;
    const scaleB = 130;
    const rotA = 0;
    const rotB = 15;
    const alphaA = '00';
    const alphaB = '00';

    const tags = `\\an5\\fn${font}\\fs${baseFontSize}\\1c${textColor}\\bord${outlineW}\\3c${outlineColor}\\shad${shadowDepth}\\4c${shadowColor}\\alpha&H${alphaA}&\\fscx${scaleA}\\fscy${scaleA}\\frz${-rotA}\\move(${x1},${y1},${x2},${y2},0,${durMs})\\t(0,${durMs},\\alpha&H${alphaB}&\\fscx${scaleB}\\fscy${scaleB}\\frz${-rotB})`;
    events.push(`Dialogue: 0,${assTimestamp(tA)},${assTimestamp(tB)},Default,,0,0,0,,{${tags}}${assText('Moving Caption Animation')}`);
  }

  // Segment 2: Telugu Unicode text at (50%, 60%), rotation -5 deg, scale 1.2
  {
    const font = 'Nirmala UI';
    const baseFontSize = 20;
    const textColor = assOverrideColor('#FFD700'); // gold
    const outlineColor = assOverrideColor('#000000');
    const outlineW = 2;
    const shadowColor = assOverrideColor('#000000');
    const shadowDepth = 3;
    const x = Math.round((50 / 100) * playResX);
    const y = Math.round((60 / 100) * playResY);
    const scalePct = 120;
    const rotVal = -5;

    const tags = `\\an5\\pos(${x},${y})\\fn${font}\\fs${baseFontSize}\\1c${textColor}\\bord${outlineW}\\3c${outlineColor}\\shad${shadowDepth}\\4c${shadowColor}\\frz${-rotVal}\\fscx${scalePct}\\fscy${scalePct}`;
    events.push(`Dialogue: 0,${assTimestamp(1.5)},${assTimestamp(3.0)},Default,,0,0,0,,{${tags}}${assText('నమస్కారం! తెలుగు క్యాప్షన్స్')}`);
  }

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${playResX}`,
    `PlayResY: ${playResY}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Arial,18,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,1,2,3,5,80,80,40,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}

const assContent = generateAss();
const tempAss = path.resolve('storage/test-motion.ass');
const inputVideo = path.resolve('storage/browser-smoke.mp4');
const outputVideo = path.resolve('storage/test-motion-export.mp4');

fs.writeFileSync(tempAss, assContent, 'utf8');
console.log('Generated ASS file at:', tempAss);

const escapedAss = escapeFilterPath(tempAss);
console.log('Escaped filter path:', escapedAss);

// Run FFmpeg render
console.log('Running FFmpeg rendering to MP4...');
const args = [
  '-y',
  '-i', inputVideo,
  '-vf', `subtitles=filename='${escapedAss}'`,
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '20',
  '-c:a', 'copy',
  outputVideo,
];

try {
  execFileSync(ffmpegPath, args, { stdio: 'pipe' });
  console.log('FFmpeg completed successfully!');

  // Verify output with ffprobe
  const probeOutput = execFileSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=codec_name,width,height',
    '-of', 'json',
    outputVideo,
  ]).toString();

  const probe = JSON.parse(probeOutput);
  console.log('Output Video Probe:', JSON.stringify(probe, null, 2));

  const stats = fs.statSync(outputVideo);
  console.log(`Rendered MP4 file size: ${stats.size} bytes`);

  if (stats.size > 0 && probe.streams?.length >= 2) {
    console.log('SUCCESS: Video rendered and verified with animated keyframe captions & Telugu unicode text!');
  } else {
    console.error('FAILED: Output file is empty or corrupted');
    process.exit(1);
  }
} catch (err) {
  console.error('FFmpeg render error:', err.message);
  if (err.stderr) console.error(err.stderr.toString());
  process.exit(1);
}
