declare module "simple-peer" {
  export type SignalData = unknown;

  export interface PeerOptions {
    initiator?: boolean;
    trickle?: boolean;
    stream?: MediaStream;
  }

  export default class Peer {
    constructor(opts?: PeerOptions);
    on(event: 'signal', cb: (data: SignalData) => void): void;
    on(event: 'stream', cb: (stream: MediaStream) => void): void;
    on(event: 'close', cb: () => void): void;
    on(event: 'error', cb: (err?: Error) => void): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    signal(data: SignalData): void;
    destroy(err?: Error): void;
  }
}

