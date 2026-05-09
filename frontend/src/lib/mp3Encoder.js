import { Mp3Encoder } from "@breezystack/lamejs";

// Convert AudioBuffer (Float32 mono/stereo) into an MP3 Blob via lamejs.
export function audioBufferToMp3Blob(audioBuffer, kbps = 320) {
  const numCh = Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new Mp3Encoder(numCh, sampleRate, kbps);

  const left = audioBuffer.getChannelData(0);
  const right = numCh === 2 ? audioBuffer.getChannelData(1) : null;
  const length = left.length;

  const floatToInt16 = (arr) => {
    const out = new Int16Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      const s = Math.max(-1, Math.min(1, arr[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const leftI16 = floatToInt16(left);
  const rightI16 = right ? floatToInt16(right) : null;

  const frameSize = 1152;
  const chunks = [];
  for (let i = 0; i < length; i += frameSize) {
    const l = leftI16.subarray(i, i + frameSize);
    let mp3buf;
    if (rightI16) {
      const r = rightI16.subarray(i, i + frameSize);
      mp3buf = encoder.encodeBuffer(l, r);
    } else {
      mp3buf = encoder.encodeBuffer(l);
    }
    if (mp3buf.length > 0) chunks.push(mp3buf);
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);

  return new Blob(chunks, { type: "audio/mp3" });
}
