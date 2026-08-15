import { joinRoom } from 'trystero';
import type { WireMessage } from './protocol';

const APP_ID = 'briscas-oro-copa-espada-basto';
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

function openRoom(code: string) {
  return joinRoom(
    {
      appId: APP_ID,
      password: code,
    },
    `briscas-${code}`,
  );
}

function bindMesa(code: string, room: ReturnType<typeof openRoom>, peerId: string): Mesa {
  const wire = room.makeAction('wire');
  const messageHandlers: Array<(message: WireMessage) => void> = [];
  const queued: WireMessage[] = [];
  const closeHandlers: Array<() => void> = [];

  wire.onMessage = (raw) => {
    const message = raw as WireMessage;
    if (!message || typeof message !== 'object' || !message.type) return;
    if (messageHandlers.length === 0) {
      queued.push(message);
      return;
    }
    for (const handler of messageHandlers) handler(message);
  };

  room.onPeerLeave = (left) => {
    if (left !== peerId) return;
    for (const handler of closeHandlers) handler();
  };

  return {
    code,
    send(message) {
      void wire.send(message as never, { target: peerId });
    },
    onMessage(handler) {
      messageHandlers.push(handler);
      while (queued.length > 0) {
        const next = queued.shift();
        if (next) handler(next);
      }
    },
    onClose(handler) {
      closeHandlers.push(handler);
    },
    destroy() {
      room.leave();
    },
  };
}

export async function hostMesa(code: string): Promise<Hosting> {
  const room = openRoom(code);
  let taken = false;

  const whenGuest = new Promise<Mesa>((resolve) => {
    room.onPeerJoin = (peerId) => {
      if (taken) return;
      taken = true;
      resolve(bindMesa(code, room, peerId));
    };
  });

  return {
    code,
    whenGuest,
    destroy() {
      room.leave();
    },
  };
}

export function joinMesa(code: string): Promise<Mesa> {
  return new Promise((resolve, reject) => {
    const room = openRoom(code);
    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      room.leave();
      reject(new Error('No se encontró esa mesa.'));
    }, 25000);

    room.onPeerJoin = (peerId) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(bindMesa(code, room, peerId));
    };

    room.onPeerLeave = () => {
      /* host may bounce once while connecting */
    };
  });
}
