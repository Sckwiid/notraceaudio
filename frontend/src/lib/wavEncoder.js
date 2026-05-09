// Encodes an AudioBuffer to a 16-bit PCM WAV Blob.
// Re-encoding from raw samples strips ALL original metadata
// (ID3 tags, custom RIFF chunks, AI fingerprints, etc.).
export function audioBufferToWavBlob(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;

  const ab = new ArrayBuffer(bufferSize);
  const view = new DataView(ab);

  let offset = 0;
  const writeStr = (s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
  };
  const writeU32 = (v) => {
    view.setUint32(offset, v, true);
    offset += 4;
  };
  const writeU16 = (v) => {
    view.setUint16(offset, v, true);
    offset += 2;
  };

  // RIFF header
  writeStr("RIFF");
  writeU32(bufferSize - 8);
  writeStr("WAVE");

  // fmt chunk
  writeStr("fmt ");
  writeU32(16);
  writeU16(1); // PCM
  writeU16(numChannels);
  writeU32(sampleRate);
  writeU32(byteRate);
  writeU16(blockAlign);
  writeU16(bitsPerSample);

  // data chunk
  writeStr("data");
  writeU32(dataSize);

  // Interleave channels and convert float -> 16-bit PCM
  const channels = [];
  for (let c = 0; c < numChannels; c++) channels.push(audioBuffer.getChannelData(c));

  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample | 0, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}
