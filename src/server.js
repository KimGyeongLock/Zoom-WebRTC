import express from "express";
import http from "http";
import SocketIO from "socket.io";
// import { Server } from "socket.io";
// import { instrument } from "@socket.io/admin-ui";

const app = express();

app.set('view engine', "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

// 같은 서버에서 http랑 ws 서버 둘 다 돌림(같은 포트에서 처리 가능)
const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);


const handleListen = () => console.log('Listening on http://localhost:3000');
httpServer.listen(3000, handleListen);