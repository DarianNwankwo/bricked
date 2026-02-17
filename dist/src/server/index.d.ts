import { SessionManager } from './state/SessionManager.js';
export interface StartServerOptions {
    port?: number;
}
export declare function createApp(): {
    app: import("express-serve-static-core").Express;
    sessionManager: SessionManager;
};
export declare function startServer(options?: StartServerOptions): Promise<{
    app: import("express-serve-static-core").Express;
    httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
    io: import("socket.io").Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
    sessionManager: SessionManager;
}>;
export default createApp;
//# sourceMappingURL=index.d.ts.map