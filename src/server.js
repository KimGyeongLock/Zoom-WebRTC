import express from "express";
import http from "http";
import SocketIO from "socket.io";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

// 같은 서버에서 http랑 ws 서버 둘 다 돌림(같은 포트에서 처리 가능)
const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

wsServer.on("connection", socket => {
    socket.on("join_room", async (roomName, email) => {
        const room = wsServer.sockets.adapter.rooms.get(roomName);
        const userCount = room ? room.size : 0;
        console.log("방 ", roomName,"의 인원 : ", userCount);

        // 2명 이상이면 room_full event 발생시킴
        if(userCount >= 2)
            socket.emit("room_full");
        else {
            socket.join(roomName);
            // 이메일을 소켓 객체에 저장
            socket.email = email;
            // 자기 자신도 initCall을 호출할 수 있게 함
            socket.emit("welcome_self", () => {
                // 클라이언트가 welcome_self 처리를 완료했다는 응답을 보낸 후 실행
                socket.to(roomName).emit("welcome");
            });

            // 입장한 사용자의 이메일로 입장 알림을 줌
            wsServer.to(roomName).emit("notification", `${email}님이 입장하셨습니다.`);
        }
    });
    // caller가 offer로 보낸 sdp를 통화를 연결하려는 방에 보냄
    socket.on("offer", (offer, roomName)=>{
        // console.log("roomName:", roomName, " offer : ", offer);
        socket.to(roomName).emit("offer", offer);
    });
    socket.on("answer", (answer, roomName)=>{
        socket.to(roomName).emit("answer", answer);
    });
    socket.on("ice", (ice, roomName)=> {
        socket.to(roomName).emit("ice", ice);
    });
    // 통화 종료 
    socket.on("leave_room", (roomName)=> {
        console.log(socket.email, "님이 방 ", roomName, "에서 나갔습니다.");
        socket.leave(roomName);
        wsServer.to(roomName).emit("notification", `${socket.email}님이 퇴장하셨습니다.`);
    });
});

const handleListen = () => console.log('Listening on http://localhost:3000');
httpServer.listen(3000, handleListen);