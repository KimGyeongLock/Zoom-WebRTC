// 알아서 socket.io가 구동되는 서버를 찾아서 연결함
const socket = io();

const welcome = document.getElementById("welcome")
const form = document.getElementById("roomSetting");
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
    const input = room.querySelector("#msg input");
    // 백엔드로 갈 new_message 이벤트 발생. input과 room 이름이 넘어가고 
    // ul아래 li로 추가될 You: ${입력값} 으로 나오는 function addMsg 동작
    const inputText = input.value;
    socket.emit("new_message", input.value, roomName, () => {
        addMessage(`You: ${inputText}`);
    });
    // emit이 비동기라 그냥 =""해버리면 값이 지워져서 보내짐
    input.value = "";
}

function handleNicknameSubmit(e) {
    e.preventDefault();
    const input = room.querySelector("#name input");
    const inputText = input.value;
    socket.emit("nickname", inputText);
    input.value = "";
}

function showRoom(){
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}`;
    const msgForm = room.querySelector("#msg");
    const nameForm = room.querySelector("#name");
    msgForm.addEventListener("submit", handleMessageSubmit);
    nameForm.addEventListener("submit", handleNicknameSubmit);
}

function handleRoomSubmit(e){
    e.preventDefault();
    const input = document.querySelector("input")
    // 아무 이벤트에 객체도 보낼 수 있음(전에는 String이어야만 함)
    // 3번째 인자에는 백에서 호출되고 프론트에서 실행됨
    // 백에서는 보안 문제로 절대 실행되지 않음.
    socket.emit("enter_room", input.value, showRoom);
    roomName = input.value;
    input.value = "";
}

form.addEventListener("submit", handleRoomSubmit);

socket.on("welcome", (user, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${user} Joined`);
});

socket.on("bye", (left, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})`;
    addMessage(`${left} Left`);
});

// addMessage가 파라미터로 msg를 이미 받고있기 때문에(정의상)
// 그냥 함수명만 써줘도 됨
// 받은 메시지 표시하는 함수
socket.on("new_message", addMessage);

socket.on("room_change", (rooms)=> {
    // 이게 없으면 아래의 foreach가 돌아가지 않기 때문에 
    // 방이 하나도 없으면 갱신이 안됨.
    // 그래서 방이 하나도 없으면 빈칸을 만들고 종료시킴
    const roomList = welcome.querySelector("ul");
    // rooms가 하나도 없을때만 비워주면 새로운게 추가되었을때 중복된 방 이름이 또 붙게 되므로
    // 이걸 실행할때마다 그냥 리스트 비워주고 시작
    roomList.innerHTML = "";
    if(rooms.length == 0){
        return;
    }
    
    rooms.forEach(room => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });
});