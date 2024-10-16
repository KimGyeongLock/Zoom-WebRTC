// 알아서 socket.io가 구동되는 서버를 찾아서 연결함
const socket = io();

const welcome = document.getElementById("welcome")
const form = welcome.querySelector("form");
const room = document.getElementById("room");

room.hidden = true;

let roomName;

function addMessage(msg){
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = msg;
    ul.appendChild(li);
}

function handleMessageSubmit(e) {
    e.preventDefault();
    const input = room.querySelector("input");
    // 백엔드로 갈 new_message 이벤트 발생. input과 room 이름이 넘어가고 
    // ul아래 li로 추가될 You: ${입력값} 으로 나오는 function addMsg 동작
    const inputText = input.value;
    socket.emit("new_message", input.value, roomName, () => {
        addMessage(`You: ${inputText}`);
    });
    // emit이 비동기라 그냥 =""해버리면 값이 지워져서 보내짐
    input.value = "";
}

function showRoom(){
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    const form = room.querySelector("form");
    form.addEventListener("submit", handleMessageSubmit);
}

function handleRoomSubmit(e){
    e.preventDefault();
    const input = form.querySelector("input");
    // 아무 이벤트에 객체도 보낼 수 있음(전에는 String이어야만 함)
    // 3번째 인자에는 백에서 호출되고 프론트에서 실행됨
    // 백에서는 보안 문제로 절대 실행되지 않음.
    socket.emit("enter_room", input.value, showRoom);
    roomName = input.value;
    input.value = "";
}

form.addEventListener("submit", handleRoomSubmit);

socket.on("welcome", () => {
    addMessage("Someone Joined");
});

socket.on("bye", () => {
    addMessage("Someone Left");
});

// addMessage가 파라미터로 msg를 이미 받고있기 때문에(정의상)
// 그냥 함수명만 써줘도 됨
// 받은 메시지 표시하는 함수
socket.on("new_message", (msg)=>{
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = "상대방 : " + msg;
    ul.appendChild(li);
});