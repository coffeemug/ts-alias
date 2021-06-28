import WebSocket from "ws";
import { Config, Destructor } from './config';
import { handleRequest } from './request';

/*
  Server code
*/
class Server<Context> {
  wss?: WebSocket.Server;
  constructor(public config: Config<Context>) {
  }

  async start() {
    this.wss = new WebSocket.Server({ port: this.config.port });
    this.wss.on('connection', async (socket: any) => {
      const destructors: Destructor[] = [];

      socket.on('message', async (message: string) => {
        try {
          const res = await handleRequest(socket, message, this.config);
          res && destructors.push(res);
        } catch(err) {
          // TODO: send an internal server error to the client
          console.error("ERROR: ", err);
        }
      });

      socket.on('close', async () => {
        for (const x of destructors) {
          try {
            x();
          } catch (err) {
            console.error("Failed to run the destructor");
            console.error(err);
          }
        }
      })
    });
    console.log("Server started 🚀");
  }

  async stop() {
    return new Promise((resolve, reject) => {
      this.wss?.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(undefined);
        }
      })
    })
  }
};

export { Server };
