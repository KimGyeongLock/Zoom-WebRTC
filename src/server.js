import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import SocketIO from "socket.io";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log('Listening on http://localhost:3000');

// 같은 서버에서 http랑 ws 서버 둘 다 돌림(같은 포트에서 처리 가능)
const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

wsServer.on("connection", socket => {
    socket["nickname"] = "Anon";
    socket.onAny((e)=>{
        console.log(`Socket Event: ${e}`);
    });
    socket.on("enter_room", (roomName, done) => {
        socket.join(roomName);
        done();
        // 입장 알림을 roomName에 있는 본인 제외한 모두에게 알림
        socket.to(roomName).emit("welcome", socket.nickname);
    });
    socket.on("disconnecting", () => {
        // socket.rooms는 set의 형태이므로
        socket.rooms.forEach(room => socket.to(room).emit("bye", socket.nickname));
    });
    socket.on("new_message", (msg, room, done)=> {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });
    socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
});


httpServer.listen(3000, handleListen);

// const wss = new WebSocketServer({server});
// 누군가가 서버에 연결하면 여기다가 넣어줄 것(디비 역할)
// const sockets = [];
// wss.on("connection", (socket) => {
//     sockets.push(socket);
//     // 닉네임 입력 안한사람들 위해서  
//     socket["nickname"] = "anonymous";
//     console.log("Connected to Server ");
//     // 브라우저와의 연결이 닫혔을 때 실행
//     socket.on("close", () => {
//         console.log("Disconnected from the Browser");
//     });
//     // 브라우저로부터 뭔가 메시지를 받았을때 
//     socket.on("message", msg => {
//         const message = JSON.parse(msg);
//         switch(message.type){
//             case "new_message":
//                 sockets.forEach((aSocket) => aSocket.send(`${socket.nickname}: ${message.payload}`));
//                 break;
//             case "nickname":
//                 socket["nickname"] = message.payload;
//                 break;
//         }
//     });
// });
// server.listen(3000, handleListen);