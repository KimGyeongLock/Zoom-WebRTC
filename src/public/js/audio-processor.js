class AudioProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const channelData = input[0]; // mono channel

        if (channelData) {
            // console.log("Processing audio data: ", channelData);
            // ArrayBuffer로 변환하여 메인 스레드로 보냄
            const int16Data = this.convertFloat32ToInt16(channelData);
            const audioChunk = new Uint8Array(int16Data.buffer);
            this.port.postMessage(audioChunk);
        }
        return true;
    }

    /*
    AWS Transcribe는 16비트 PCM 형식의 오디오 데이터를 요구함
    */

    // Float32Array를 Int16Array로 변환하는 함수

    // float32 값은 -1.0 ~ 1.0 범위이므로
    // Math.min, max 사용해서 범위 잡아주고 곱해줌.
    // 0x7FFF는 32767를 16진수로 표현한 것
    // 정수로 표현하는거라 소숫점이 잘리긴 하지만 실제 음질에는 영향 거의 X
    convertFloat32ToInt16(buffer){
        return buffer.map(value => Math.max(-1, Math.min(1, value)) * 0x7FFF);
    }
}


registerProcessor('audio-processor', AudioProcessor);
