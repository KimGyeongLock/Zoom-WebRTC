// 알아서 socket.io가 구동되는 서버를 찾아서 연결함
const socket = io();

// 여기다가 stream을 얻어다줄건데
// stream은 유저의 비디오와 오디오가 항상 합쳐진 형태임.
const myFace = document.getElementById("myFace");
const call = document.getElementById("call");
const endCallBtn = call.querySelector("button");
// 이메일 입력칸
const emailInput = document.getElementById("email");
// 알림 로그 출력칸, 음성 텍스트 변환 결과 도 표시
const logList = document.getElementById("logList");

// voice w voice, voice w chat, chat w chat
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");

call.hidden = true;
chatBox.hidden = true;

endCallBtn.addEventListener("click", handleEndCall);

// 하울링 방지
document.getElementById("myFace").volume = 0;

let myStream;
let roomName;
let myPeerConnection;

// 실시간 채팅을 위한 DataChannel
let myDataChannel;

async function getMedia(deviceId) {
  const initialConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(initialConstraints);
    myFace.srcObject = myStream;
    
  } catch (e) {
    console.log(e);
  }
}

// Welcome Form (join a room)
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  // 기존 PeerConnection이 남아 있는 경우를 대비해 새로 설정
  if (!myPeerConnection) {
    makeConnection();
  }
}

// 방이 꽉 찼을 때 실행됨
socket.on("room_full", () => {
  alert("해당 방은 이미 통화가 진행 중입니다. 입장할 수 없습니다.");
  call.hidden = true;
  welcome.hidden = false;
});

// 입장했을때 자신에게 전송된 welcome_self로 initCall 호출해서
// myPeerConnection 초기화
socket.on("welcome_self", async (callback) => {
  await initCall();
  if (callback) {
    // 서버로 ack을 보냄
    callback();
  }
});

async function handleWelcomeSubmit(e) {
  e.preventDefault();
  const roomInput = welcomeForm.querySelector("input#room");
  const email = emailInput.value;
  const room = roomInput.value;
  const screenType = welcomeForm.querySelector(
    "input[name='screenType']:checked"
  ).value;

  // 방과 이메일을 함께 서버에 전송
  // screenType도 같이 보내서 with Chat일때만 실행
  socket.emit("join_room", room, email, screenType);
  roomName = room;
  roomInput.value = "";
  emailInput.value = "";

  // 화면 종류에 따라 다른 화면 보여주기
  if (screenType === "voice") {
    console.log("checked voice");
    call.hidden = false;
    chatBox.hidden = true;
  } else if (screenType === "chat") {
    console.log("checked with chat");
    call.hidden = false;
    chatBox.hidden = false;
  }
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

/////////////////////////// Socket code /////////////////////////////

// caller쪽에서 실행되는 것
// 두명이 다 도착해야 실행
socket.on("welcome", async () => {
  // DataChannel은 Offer을 생성해주기 전에 만들어야 함
  myDataChannel = myPeerConnection.createDataChannel("chat");
  // 관련 이벤트 리스너 등록해주기
  myDataChannel.addEventListener("message", (msg) => {
    console.log("Received from peer:", msg.data);
    // 내가 방을 만든 경우 상대방이 방에 들어오는 경우, 나는 콜포비아(채팅러), 상대방(보이스)
    // displayPeerMessage(msg.data);
    socket.emit("request_tts", msg.data, roomName);
  });

  // caller가 SDP를 생성함(offer)
  const offer = await myPeerConnection.createOffer();
  // caller
  myPeerConnection.setLocalDescription(offer);
  console.log("caller : sent to : ", roomName);
  // 어느 방에 전송할지, 그 방의 누구에게 전송할 지
  socket.emit("offer", offer, roomName);
});

// 서버에서 전송된 transcript 결과를 받아 DataChannel을 통해 상대방에게 전송
socket.on("transcript", (transcript) => {
  if (myDataChannel && myDataChannel.readyState === "open") {
    // myDataChannel.send(transcript);
    displayPeerMessage(transcript);
  }
});

// callee가 caller가 프론트에서 offer로 보낸 sdp가
// 서버에서 emit(offer, roomName)으로 처리됬기 때문에
// 다시 callee의 프론트에서 해당 이벤트를 받아서 offer를 받음

// 그리고 상대의 sdp(offer나 answer, 여기서는 offer)
// 를 저장함(setRemoteDescription)

// 그리고 sdp(answer)를 생성함
// answer를 localDescription으로 등록하고
// 서버에 answer 이벤트로 보냄

// Peer B(callee)의 remoteDescription 이후
// getUserMedia랑 addStream(addTrack)은 makeConnection에서 이미
// 방에 입장할때 해 주었으므로 따로 하지 않음.


// callee 쪽에서 실행되는 것
socket.on("offer", async (offer) => {
  // offer를 받는 callee는 만들어진 datachannel를 받아서 사용하고
  // 거기다가 이벤트 리스너만 달면 된다.
  myPeerConnection.addEventListener("datachannel", (e) => {
    myDataChannel = e.channel;
    myDataChannel.addEventListener("message", async (msg) => {
      console.log("Received from caller:", msg.data);
    
      // #myStream에 메시지 표시
      // const myStreamDiv = document.querySelector("#myStream");
      // const messageElement = document.createElement("div");
      // messageElement.classList.add("peer_message", "message-bubble");
      // messageElement.innerText = msg.data;
      // myStreamDiv.appendChild(messageElement);
    
      // 서버에 TTS 요청
      socket.emit("request_tts", msg.data, roomName);
    });
    
  });

  console.log("callee : offer received : ", offer);
  myPeerConnection.setRemoteDescription(offer);

  const answer = await myPeerConnection.createAnswer();
  console.log("callee : answer 생성 : ", answer);

  myPeerConnection.setLocalDescription(answer);

  socket.emit("answer", answer, roomName);
  console.log("callee : sent answer");
});

// caller는 callee의 answer sdp를 받아서
// remoteDescription에 등록함.
socket.on("answer", (answer) => {
  console.log("caller : answer received from callee : ", answer);
  myPeerConnection.setRemoteDescription(answer);
});

// caller, callee 두 브라우저에서 둘 다 일어남
// peer(상대)가 보낸 ICE candidate 받는 함수
socket.on("ice", (ice) => {
  console.log("received ice candidate ");
  myPeerConnection.addIceCandidate(ice);
});

//////////////////////// RTC code //////////////////////////////////////

// RTC step1. peerConnection을 브라우저와 브라우저 사이에 만듬
// addStream은 낡은 함수라서 지금은 사용안함 -> addTrack씀
function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        // 5개 이상 쓰면 안 됨
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
    ],
  });
  // peerConnection을 만든 직후 Ice Candidate를 생성해야 함
  myPeerConnection.addEventListener("icecandidate", handleIce);
  // Answer & Offer -> exchange ICE candidates까지 했다면
  // addStream 을 해줘야 할 차례
  myPeerConnection.addEventListener("addstream", handleAddStream);
  // 양쪽 브라우저에서 카메라와 마이크의 데이터 stream을 받아서 그것들을 연결 안에 집어넣음
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));

  // 오디오 트랙의 bitrate 조정 (128kbps)
  const audioSender = myPeerConnection.getSenders().find((sender) => {
    sender.track.kind === "audio";
  });
  if (audioSender) {
    const param = audioSender.getParameters();
    if (!param.encodings) {
      param.encodings = [{}]; // Encodings가 없으면 빈배열 초기화
    }
    param.encodings[0].maxBitrate = 128000;
    audioSender.setParameters(param);
  }
}

// caller, callee 둘 다의 브라우저에서 일어남
// 이건 local ICE를 peer(상대)에게 보내는 함수
function handleIce(data) {
  socket.emit("ice", data.candidate, roomName);
  console.log("sent ice candidate ");
}

// ICE 후보들까지 교환하고 나서 peer(상대)의 stream을 등록
async function handleAddStream(data) {
  const peerFace = document.getElementById("peerFace");
  console.log("got an stream from my peer : ", data.stream);
  console.log("My Stream : ", myStream);
  peerFace.srcObject = data.stream;

  // AudioContext 생성
  const audioContext = new AudioContext();
  
  // TODO : 상대의 sampleRate 가져와서 동적으로 할당하기
  // console.log("Peer Browser's Sample Rate : ", audioContext.sampleRate);

  // AudioWorkletProcessor 등록
  await audioContext.audioWorklet.addModule("/public/js/audio-processor.js");
  // console.log("Audio Worklet Module added successfully");

  const source = audioContext.createMediaStreamSource(data.stream);
  const processor = new AudioWorkletNode(audioContext, "audio-processor");

  // AudioProcessor에서 메인 스레드로 전송된 데이터를 받음
  processor.port.onmessage = (event) => {
    const audioChunk = event.data;
    // console.log("MyStream Audio chunk received: ", audioChunk);

    // 다운샘플링이 필요할 때만 처리
    // let processedAudioChunk = audioChunk;
    // if (audioContext.sampleRate !== 16000) {
    //     processedAudioChunk = downsampleBuffer(audioChunk, audioContext.sampleRate, 16000);
    //     console.log("Downsampled to 16000Hz");
    // }

    // handleWelcomeSubmit에서 설정된 roomName은 전역변수라서 
    // handleAddStream에서도 접근할 수 있음.
    // socket.emit("audio_chunk", audioChunk, roomName);
    
    // "With Chat" 모드일 경우에만 audio_chunk 전송
    if (document.body.getAttribute('data-mode') === 'chat') {
      socket.emit("audio_chunk", audioChunk, roomName);
  }
  };

  source.connect(processor);
}

// 한명이 나가면 다른 한쪽도 자동으로 나가게끔 함
// leave_room 이벤트 수신 시 handleEndCall 실행
socket.on("leave_room", (roomName) => {
  console.log("Received leave_room event for room:", roomName);
  handleEndCall();
});

function handleEndCall() {
  // peerConnection을 종료해서 통화 중지
  if (myPeerConnection) {
    myPeerConnection.close();
    myPeerConnection = null;
  }

  call.hidden = true;
  chatBox.hidden = true;
  welcome.hidden = false;

  if (myStream) {
    myStream.getTracks().forEach((track) => track.stop());
  }

  // transcribe만 종료되던 문제 해결!!!
  // 먼저 webrtc, ui 정리해주고
  // 그다음에 aws transcribe 서비스, room socket.io에서 삭제
  socket.emit("leave_room", roomName);

  roomName = null;
}

// 입장, 퇴장 알림 로그 메시지를 출력하는 함수
function addLogMessage(message) {
  const li = document.createElement("li");
  li.textContent = message;
  logList.appendChild(li);
}

// 서버에서 notification 이벤트를 받으면 실행
// 계속 방에 기록 남기보단 alert로 대체
socket.on("notification_welcome", (message) => {
  alert(message);
});

socket.on("notification_bye", (message) => {
  alert(message);
  alert("확인을 누르면 통화가 종료됩니다.");
});

const chatInput = document.getElementById("chatInput");

// 이미 .hidden으로 구현되어 있지만 
// send를 보낼때마다 리셋되어 추가구현됨.
document.addEventListener("DOMContentLoaded", () => {
  // chatForm submit 이벤트 핸들링
  chatForm.addEventListener("submit", (event) => {
      event.preventDefault(); // 기본 제출 동작 방지

      const message = chatInput.value.trim();
      if (message) {
          // 메시지를 서버로 전송
          sendMessage(message);
          chatInput.value = ""; // 입력창 초기화
      }
  });
});

function sendMessage(message) {
  // DataChannel이 열려 있는지 확인하고 메시지 전송
  if (myDataChannel && myDataChannel.readyState === "open") {
    myDataChannel.send(message);
    displayMyMessage(message);  // 내 메시지를 화면에 표시하는 함수 호출
  } else {
    console.warn("DataChannel is not open. Message not sent.");
  }
}

// 내 메시지를 화면에 표시하는 함수
function displayMyMessage(message) {
  const listItem = document.createElement("li");
  listItem.classList.add("my_message");
  const bubble = document.createElement("span");
  bubble.classList.add("message-bubble");
  bubble.innerText = message;
  listItem.appendChild(bubble);
  logList.appendChild(listItem);
}

// 상대의 메시지를 화면에 표시하는 함수
function displayPeerMessage(message) {
  const listItem = document.createElement("li");
  listItem.classList.add("peer_message");
  const bubble = document.createElement("span");
  bubble.classList.add("message-bubble");
  bubble.innerText = message;
  listItem.appendChild(bubble);
  logList.appendChild(listItem);
}


// Add event listeners for radio buttons
const voiceOnlyRadio = document.getElementById('voiceOnly');
const chatAndVoiceRadio = document.getElementById('chatAndVoice');

function updateMode() {
    if (voiceOnlyRadio.checked) {
        document.body.setAttribute('data-mode', 'voice');
    } else {
        document.body.setAttribute('data-mode', 'chat');
    }
}

voiceOnlyRadio.addEventListener('change', updateMode);
chatAndVoiceRadio.addEventListener('change', updateMode);

// Set initial mode
updateMode();


/////tts 코드//////

// 오디오 재생 함수 수정
socket.on("tts_response", async (audioBase64) => {
  try {
    // Base64 디코딩
    const audioData = atob(audioBase64);
    const arrayBuffer = new ArrayBuffer(audioData.length);
    const view = new Uint8Array(arrayBuffer);

    for (let i = 0; i < audioData.length; i++) {
      view[i] = audioData.charCodeAt(i);
    }

    // AudioContext 사용
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const decodedData = await audioContext.decodeAudioData(arrayBuffer);

    // 오디오 소스 생성
    const source = audioContext.createBufferSource();
    source.buffer = decodedData;

    // 자동 재생 시도
    const playAudio = async () => {
      try {
        
        source.connect(audioContext.destination);
        source.start(0);  // 재생 시작
        
      } catch (error) {
        console.error("오디오 재생 오류:", error);
      }
    };

    await playAudio();

    // 재생 완료 후 메모리 정리
    source.onended = () => {
      source.disconnect();
      audioContext.close();
    };

  } catch (error) {
    console.error("오디오 처리 에러:", error);
  }
});