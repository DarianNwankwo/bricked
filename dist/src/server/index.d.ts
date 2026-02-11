declare const app: import("express-serve-static-core").Express;
export declare function startServer(): Promise<{
    app: import("express-serve-static-core").Express;
    httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
    io: import("socket.io").Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
}>;
export default app;
//# sourceMappingURL=index.d.ts.map