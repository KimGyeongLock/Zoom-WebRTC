// 알아서 socket.io가 구동되는 서버를 찾아서 연결함
const socket = io();

// 여기다가 stream을 얻어다줄건데 
// stream은 유저의 비디오와 오디오가 항상 합쳐진 형태임.
const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

const welcome = document.getElementById("welcome");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
// 오디오 on/off 유무 tracking
let muted = false;
// 카메라 on/off 유무 tracking
let cameraOff = false;
let roomName;

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

async function handleCameraChange(){
    await getMedia(camerasSelect.value);
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join a room)

welcomeForm = welcome.querySelector("form");

function startMedia(){
    welcome.hidden = true;
    call.hidden = false;
    getMedia();
}

function handleWelcomeSubmit(e){
    e.preventDefault();
    const input = welcomeForm.querySelector("input");
    socket.emit("join_room", input.value, startMedia);
    roomName = input.value;
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);


// Socket code
socket.on("welcome", () => {
    console.log("someone joined");
})