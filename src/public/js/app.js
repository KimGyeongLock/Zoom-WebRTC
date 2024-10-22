// 알아서 socket.io가 구동되는 서버를 찾아서 연결함
const socket = io();

// 여기다가 stream을 얻어다줄건데 
// stream은 유저의 비디오와 오디오가 항상 합쳐진 형태임.
const myFace = document.getElementById("myFace");
const call = document.getElementById("call");
const endCallBtn = call.querySelector("button");
// 이메일 입력칸
const emailInput = document.getElementById("email");
// 알림 로그 출력칸
const logList = document.getElementById("logList");

endCallBtn.addEventListener("click", handleEndCall);

// 하울링 방지
document.getElementById("myFace").volume = 0;

call.hidden = true;

let myStream;
let roomName;
let myPeerConnection;

// 실시간 채팅을 위한 DataChannel
let myDataChannel;

async function getMedia(deviceId){
    const initialConstraints = {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false // 자동 이득 제어 비활성화
        },
        video: false,
    };
    try{
        // deviceId가 있으면 (선택한 기기가 있으면) 그걸로 카메라로 쓰고
        // 없거나 맨 처음에 켠 상태라면 selfie 카메라를 기준으로 가져옴
        myStream = await navigator.mediaDevices.getUserMedia(
            initialConstraints
        );
        myFace.srcObject = myStream;
    }
    catch(e){
        console.log(e);
    }
    
}

// Welcome Form (join a room)
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall(){
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
    if(callback){
        // 서버로 ack을 보냄
        callback();
    }
});

async function handleWelcomeSubmit(e){
    e.preventDefault();
    const roomInput = welcomeForm.querySelector("input#room");
    const email = emailInput.value;
    const room = roomInput.value;
    
    // 방 인원 제한때문에 주석처리
    //await initCall();

    // 방과 이메일을 함께 서버에 전송
    socket.emit("join_room", room, email);
    roomName = room;
    roomInput.value = "";
    emailInput.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

/////////////////////////// Socket code /////////////////////////////

// caller쪽에서 실행되는 것
socket.on("welcome", async () => {
    // DataChannel은 Offer을 생성해주기 전에 만들어야 함
    myDataChannel = myPeerConnection.createDataChannel("chat");
    // 관련 이벤트 리스너 등록해주기
    myDataChannel.addEventListener("message", (msg)=> {
        console.log(msg.data.toString());
    });

    // caller가 SDP를 생성함(offer)
    const offer = await myPeerConnection.createOffer();
    // caller
    myPeerConnection.setLocalDescription(offer);
    console.log("caller : sent to : ", roomName);
    // 어느 방에 전송할지, 그 방의 누구에게 전송할 지
    socket.emit("offer", offer, roomName);
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
socket.on("offer", async (offer)=> {
    // offer를 받는 callee는 만들어진 datachannel를 받아서 사용하고
    // 거기다가 이벤트 리스너만 달면 된다.
    myPeerConnection.addEventListener("datachannel", (e)=>{
        myDataChannel = e.channel;
        myDataChannel.addEventListener("message", (msg)=> {
            console.log(msg.data.toString());
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
function makeConnection(){
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
        .forEach(track => myPeerConnection.addTrack(track, myStream));

    // 오디오 트랙의 bitrate 조정 (128kbps)
    const audioSender = myPeerConnection.getSenders().find(sender => {
        sender.track.kind === "audio"
    });
    if(audioSender){
        const param = audioSender.getParameters();
        if(!param.encodings){
            param.encodings = [{}]; // Encodings가 없으면 빈배열 초기화
        }
        param.encodings[0].maxBitrate = 128000;
        audioSender.setParameters(param);
    }
}

// caller, callee 둘 다의 브라우저에서 일어남
// 이건 local ICE를 peer(상대)에게 보내는 함수
function handleIce(data){
    socket.emit("ice", data.candidate, roomName);
    console.log("sent ice candidate ");   
}

// ICE 후보들까지 교환하고 나서 peer(상대)의 stream을 등록
function handleAddStream(data) {
    const peerFace = document.getElementById("peerFace");
    console.log("got an stream from my peer : ", data.stream);
    console.log("My Stream : ", myStream);
    peerFace.srcObject = data.stream;
}

function handleEndCall(){
    socket.emit("leave_room", roomName);
    // peerConnection을 종료해서 통화 중지
    if(myPeerConnection){
        myPeerConnection.close();
        myPeerConnection = null;
    }

    call.hidden = true;
    welcome.hidden = false;

    if(myStream){
        myStream.getTracks().forEach(track => track.stop());
    }

    roomName = null;
}

// 입장, 퇴장 알림 로그 메시지를 출력하는 함수
function addLogMessage(message) {
    const li = document.createElement("li");
    li.textContent = message;
    logList.appendChild(li);
}

// 서버에서 notification 이벤트를 받으면 실행
socket.on("notification", (message) => {
    addLogMessage(message);
})