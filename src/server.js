import express from "express";
import http from "http";
// import SocketIO from "socket.io";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log('Listening on http://localhost:3000');

// 같은 서버에서 http랑 ws 서버 둘 다 돌림(같은 포트에서 처리 가능)
const httpServer = http.createServer(app);
// const wsServer = SocketIO(httpServer);
const wsServer = new Server(httpServer, {
    cors: {
      origin: ["https://admin.socket.io"],
      credentials: true
    }
  }
);

instrument(wsServer, {
    auth: false,
    mode: "development",
  });

function publicRooms() {
    const sids = wsServer.sockets.adapter.sids;
    const rooms = wsServer.sockets.adapter.rooms;
    const publicRooms = [];
    rooms.forEach((_, key)=> {
        if(sids.get(key) === undefined){
            publicRooms.push(key);
        }
    });
    return publicRooms;
}

function countRoom(roomName){
    return wsServer.sockets.adapter.rooms.get(roomName)?.size; 
}

wsServer.on("connection", socket => {
    socket["nickname"] = "Anon";
    socket.onAny((e)=>{
        console.log(wsServer.sockets.adapter);
        console.log(`Socket Event: ${e}`);
    });
    socket.on("enter_room", (roomName, done) => {
        socket.join(roomName);
        done();
        // 입장 알림을 roomName에 있는 본인 제외한 모두에게 알림
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
        wsServer.sockets.emit("room_change", publicRooms());
    });
    socket.on("disconnecting", () => {
        // socket.rooms는 set의 형태이므로
        socket.rooms.forEach(room =>
            // countRoom -1 인 이유는
            // disconnecting은 아직 방을 떠나지 않았으므로 아직 본인이 포함되어있는 상태
            // 그래서 본인을 빼 줘야함
            socket.to(room).emit("bye", socket.nickname, countRoom(room)-1)
        );
    });
    socket.on("disconnect", ()=>{
        wsServer.sockets.emit("room_change", publicRooms());
    });
    socket.on("new_message", (msg, room, done)=> {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });
    socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
});


httpServer.listen(3000, handleListen);