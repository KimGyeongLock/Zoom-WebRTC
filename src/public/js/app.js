// 알아서 socket.io가 구동되는 서버를 찾아서 연결함
const socket = io();

// 여기다가 stream을 얻어다줄건데 
// stream은 유저의 비디오와 오디오가 항상 합쳐진 형태임.
const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");


const call = document.getElementById("call");

call.hidden = true;

let myStream;
// 오디오 on/off 유무 tracking
let muted = false;
// 카메라 on/off 유무 tracking
let cameraOff = false;
let roomName;
let myPeerConnection;

async function getCameras(){
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        // 디바이스 목록중에 종류가 videoinput 인 것만 가져오기
        const cameras = devices.filter(device =>  device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        // 카메라 출력 옵션 고르게 해 주기
        cameras.forEach(camera => {
            const option = document.createElement("option");
            // deviceId를 가지고 카메라 스위칭할거임
            option.value = camera.deviceId;
            option.innerText = camera.label;
            // stream의 현재 카메라와 paint할 때의 카메라 option 가져오기
            // 현재 사용하는 카메라가 현재 가능한 카메라 리스트중 선택되있게 함
            if(currentCamera.label == camera.label){
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        })
    } catch (error) {
        console.log(error);
    }
}

async function getMedia(deviceId){
    const initialConstraints = {
        audio: true,
        video: { facingMode: "user" },
    };
    const cameraConstraints = {
        audio: true,
        video: { deviceId: { exact: deviceId }},
    };
    try{
        // deviceId가 있으면 (선택한 기기가 있으면) 그걸로 카메라로 쓰고
        // 없거나 맨 처음에 켠 상태라면 selfie 카메라를 기준으로 가져옴
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId? cameraConstraints : initialConstraints
        );
        myFace.srcObject = myStream;
        if(!deviceId){
            await getCameras();
        }
    }
    catch(e){
        console.log(e);
    }
    
}
// id 없이 호출하면 셀피 카메라를 쓰는 constraint를 생성할거임
// getMedia();

function handleMuteClick(){
    myStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
    });
    if(!muted){
        muteBtn.innerText = "Mute";
        muted = true;
    }
    else{
        muteBtn.innerText = "Unmute";
        muted = false;
    }
}

function handleCameraClick(){
    myStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
    })
    if(!cameraOff){
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
    else{
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    }
}

// 카메라 입력 장치 바꿧을 때 
// peer video에도 바뀌게끔 수정
async function handleCameraChange(){
    // 여기서 새 deviceID로 mediaStream을 생성하게 됨.
    await getMedia(camerasSelect.value);
    if(myPeerConnection){
        // 그럼 여기서 저 새 deviceID로 stream 접근 가능
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders()
            .find(sender => sender.track.kind === "video");
        console.log(videoSender);
        // 지금 내 stream을 보내는 sender에게 아까 선택한 videoTrack으로
        // track을 교체하고 그걸로 송출함
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join a room)
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall(){
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(e){
    e.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

/////////////////////////// Socket code /////////////////////////////

socket.on("welcome", async () => {
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
socket.on("answer", answer => {
    console.log("caller : answer received from callee : ", answer);
    myPeerConnection.setRemoteDescription(answer);
});

// caller, callee 두 브라우저에서 둘 다 일어남
// peer(상대)가 보낸 ICE candidate 받는 함수
socket.on("ice", ice => {
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
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
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