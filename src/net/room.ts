import { Peer, type DataConnection } from 'peerjs';
import type { WireMessage } from './protocol';

const PREFIX = 'briscas-mesa-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(): string {
  return Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
}

export function roomLink(code: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mesa', code);
  return url.toString();
}

export function mesaFromUrl(): string | null {
  const code = new URL(window.location.href).searchParams.get('mesa');
  return code ? code.trim().toUpperCase() : null;
}

export interface Mesa {
  code: string;
  send: (message: WireMessage) => void;
  onMessage: (handler: (message: WireMessage) => void) => void;
  onClose: (handler: () => void) => void;
  destroy: () => void;
}

export interface Hosting {
  code: string;
  whenGuest: Promise<Mesa>;
  destroy: () => void;
}

function bind(conn: DataConnection, peer: Peer, code: string): Mesa {
  const messageHandlers: Array<(message: WireMessage) => void> = [];
  const closeHandlers: Array<() => void> = [];

  conn.on('data', (data) => {
    if (!data || typeof data !== 'object') return;
    const message = data as WireMessage;
    if (!message.type) return;
    for (const handler of messageHandlers) handler(message);
  });

  const closed = (): void => {
    for (const handler of closeHandlers) handler();
  };
  conn.on('close', closed);
  conn.on('error', closed);

  return {
    code,
    send(message) {
      if (conn.open) conn.send(message);
    },
    onMessage(handler) {
      messageHandlers.push(handler);
    },
    onClose(handler) {
      closeHandlers.push(handler);
    },
    destroy() {
      conn.close();
      peer.destroy();
    },
  };
}

export function hostMesa(code: string): Promise<Hosting> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(`${PREFIX}${code}`);
    const timer = window.setTimeout(() => {
      peer.destroy();
      reject(new Error('No se pudo abrir la mesa.'));
    }, 8000);

    peer.on('error', (error) => {
      window.clearTimeout(timer);
      peer.destroy();
      reject(error);
    });

    peer.on('open', () => {
      window.clearTimeout(timer);
      const whenGuest = new Promise<Mesa>((guestResolve) => {
        peer.on('connection', (conn) => {
          conn.on('open', () => guestResolve(bind(conn, peer, code)));
        });
      });
      resolve({
        code,
        whenGuest,
        destroy() {
          peer.destroy();
        },
      });
    });
  });
}

export function joinMesa(code: string): Promise<Mesa> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    const timer = window.setTimeout(() => {
      peer.destroy();
      reject(new Error('No se encontró esa mesa.'));
    }, 14000);

    const fail = (error: unknown): void => {
      window.clearTimeout(timer);
      peer.destroy();
      reject(error);
    };

    peer.on('error', fail);
    peer.on('open', () => {
      const conn = peer.connect(`${PREFIX}${code}`, { reliable: true });
      conn.on('error', fail);
      conn.on('open', () => {
        window.clearTimeout(timer);
        resolve(bind(conn, peer, code));
      });
    });
  });
}
