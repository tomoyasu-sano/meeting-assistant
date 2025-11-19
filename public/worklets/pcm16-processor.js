class PCM16Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferQueue = [];
    this._queuedSamples = 0;
    this._chunkSize = Math.round(sampleRate / 2); // 500ms chunks
  }

  /**
   * 16bit PCM へ変換し、メインスレッドへ送信
   */
  _emitChunk(floatChunk) {
    const int16 = new Int16Array(floatChunk.length);
    for (let i = 0; i < floatChunk.length; i++) {
      const sample = Math.max(-1, Math.min(1, floatChunk[i]));
      int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    this.port.postMessage(int16, [int16.buffer]);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelData = input[0];
    if (!channelData) {
      return true;
    }

    // Float32Array をキューに積む
    this._bufferQueue.push(channelData.slice());
    this._queuedSamples += channelData.length;

    while (this._queuedSamples >= this._chunkSize) {
      const chunk = new Float32Array(this._chunkSize);
      let offset = 0;

      // キューから必要分だけ取り出して結合
      while (offset < this._chunkSize && this._bufferQueue.length > 0) {
        const current = this._bufferQueue[0];
        const remaining = this._chunkSize - offset;

        if (current.length <= remaining) {
          chunk.set(current, offset);
          offset += current.length;
          this._bufferQueue.shift();
        } else {
          chunk.set(current.subarray(0, remaining), offset);
          this._bufferQueue[0] = current.subarray(remaining);
          offset += remaining;
        }
      }

      this._queuedSamples -= this._chunkSize;
      this._emitChunk(chunk);
    }

    return true;
  }
}

registerProcessor("pcm16-processor", PCM16Processor);
