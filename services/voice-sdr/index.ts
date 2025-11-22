import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const port = Number(process.env.PORT || 8080);

app.get("/", (_req, res) => res.send("voice-sdr up"));

const server = app.listen(port, () => {
  console.log(`HTTP listening on ${port}`);
});

const wss = new WebSocketServer({ server, path: "/voice-media" });

wss.on("connection", (ws) => {
  console.log("ws connected");
  ws.on("message", (msg) => {
    // echo V1
    ws.send(msg.toString());
  });
  ws.on("close", () => console.log("ws closed"));
});

