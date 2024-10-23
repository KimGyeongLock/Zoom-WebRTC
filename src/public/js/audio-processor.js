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

/*
todo
AudioWorklet에서 오디오 데이터를 처리할 때, 데이터를 **Uint16Array**로 변환하는 것은 올바른 접근 방식이 아닙니다. AudioWorklet에서 제공되는 오디오 데이터는 Float32Array 형식으로, -1.0에서 1.0 사이의 범위 값을 가지는 32비트 부동 소수점(32-bit float) 값입니다. 이 값을 16비트 PCM 형식으로 변환해야 합니다.

따라서 Uint16Array 대신, **Int16Array**로 변환한 후 이를 **Uint8Array**로 패키징하여 서버로 전송해야 합니다.


*/