class AudioProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const channelData = input[0]; // mono channel

        if (channelData) {
            // ArrayBuffer로 변환하여 메인 스레드로 보냄
            const audioChunk = new Uint8Array(channelData.buffer);
            this.port.postMessage(audioChunk);
        }
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);